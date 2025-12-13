<script setup lang="ts">
import type { CoreMessageMediaFromBlob } from '@tg-search/core'
import type { CoreMessage } from '@tg-search/core/types'
import type { AnimationItem } from 'lottie-web'

import lottie from 'lottie-web'
import pako from 'pako'

import { getMediaBinaryProvider, hydrateMediaBlobWithCore, useSettingsStore } from '@tg-search/client'
import { models } from '@tg-search/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import MediaWebpage from './MediaWebpage.vue'

const props = defineProps<{
  message: CoreMessage & {
    media?: CoreMessageMediaFromBlob[]
  }
}>()

const runtimeError = ref<string>()
const { debugMode } = storeToRefs(useSettingsStore())

export interface WebpageData {
  title: string
  description?: string
  siteName?: string
  url?: string
  displayUrl?: string
  previewImage?: string
}

export interface ProcessedMedia {
  src: string | undefined
  type: CoreMessageMediaFromBlob['type']
  error?: string
  webpageData?: WebpageData
  mimeType?: string
  width?: number
  height?: number
}

const processedMedia = computed<ProcessedMedia>(() => {
  const mediaItem = props.message.media?.[0]
  if (!mediaItem) {
    return {
      src: undefined,
      type: 'unknown',
    } satisfies ProcessedMedia
  }

  switch (mediaItem.type) {
    case 'webpage': {
      return {
        // TODO: fix the preview image
        src: mediaItem.displayUrl,
        type: mediaItem.type,
        webpageData: {
          title: mediaItem.title,
          description: mediaItem.description,
          siteName: mediaItem.siteName,
          url: mediaItem.url,
          displayUrl: mediaItem.displayUrl,
        },
      } satisfies ProcessedMedia
    }
    case 'photo': {
      return {
        src: mediaItem.blobUrl,
        type: mediaItem.type,
        mimeType: mediaItem.mimeType,
      } satisfies ProcessedMedia
    }
    case 'sticker': {
      return {
        src: mediaItem.blobUrl,
        type: mediaItem.type,
        mimeType: mediaItem.mimeType,
      } satisfies ProcessedMedia
    }
    default:
      return {
        src: undefined,
        type: 'unknown',
      } satisfies ProcessedMedia
  }
})

// In With Core mode, lazily hydrate media blobs from the embedded database
// only when this component is mounted and has a media item to render.
if (import.meta.env.VITE_WITH_CORE) {
  watch(
    () => props.message.media?.[0],
    (mediaItem) => {
      if (!mediaItem || !mediaItem.queryId || mediaItem.blobUrl)
        return

      void hydrateMediaBlobWithCore(mediaItem, models.photoModels, models.stickerModels, getMediaBinaryProvider())
    },
    { immediate: true },
  )
}

const isLoading = computed(() => {
  return !processedMedia.value.src && processedMedia.value.type !== 'unknown' && (!!props.message.media && props.message.media.length > 0)
})

const finalError = computed(() => {
  return processedMedia.value.error || runtimeError.value
})

let animation: AnimationItem | null = null
const tgsContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  if (animation) {
    animation.destroy()
    animation = null
  }

  nextTick(() => {
    if (
      processedMedia.value.type === 'sticker'
      && processedMedia.value.mimeType === 'application/gzip'
      && processedMedia.value.src
      && tgsContainer.value
    ) {
      if (!processedMedia.value.src)
        return

      fetch(processedMedia.value.src)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => pako.inflate(arrayBuffer, { to: 'string' }))
        .then((data) => {
          animation = lottie.loadAnimation({
            container: tgsContainer.value!,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: JSON.parse(data),
          })
        })
        .catch((error) => {
          console.error('Failed to fetch Lottie animation data', error)
          runtimeError.value = 'Sticker failed to load'
        })
    }
  })
})

onUnmounted(() => {
  if (animation)
    animation.destroy()
})
</script>

<template>
  <code v-if="debugMode && processedMedia.type !== 'unknown'" class="whitespace-pre-wrap text-xs">
    {{ JSON.stringify(processedMedia, null, 2) }}
  </code>

  <div v-if="message.content" class="mb-2 whitespace-pre-wrap text-gray-900 dark:text-gray-100">
    {{ message.content }}
  </div>

  <!-- Loading state with dynamic placeholder sizing based on actual image dimensions -->
  <div v-if="isLoading" class="flex items-center">
    <div
      class="max-w-xs w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
      :style="processedMedia.width && processedMedia.height
        ? { aspectRatio: `${processedMedia.width} / ${processedMedia.height}`, height: 'auto' }
        : { height: '12rem' }"
    />
  </div>

  <!-- Error state -->
  <div v-if="finalError && debugMode" class="flex items-center gap-2 rounded bg-red-100 p-2 dark:bg-red-900">
    <div class="i-lucide-alert-circle h-4 w-4 text-red-500" />
    <span class="text-sm text-red-700 dark:text-red-300">{{ finalError }}</span>
  </div>

  <!-- Media content -->
  <template v-if="processedMedia.type !== 'unknown'">
    <div v-if="processedMedia.src">
      <MediaWebpage
        v-if="processedMedia.type === 'webpage'"
        :processed-media="processedMedia"
        @error="runtimeError = 'Webpage failed to load'"
      />

      <img
        v-else-if="processedMedia.type === 'photo'"
        :src="processedMedia.src"
        class="h-auto max-w-xs rounded-lg"
        :style="processedMedia.width && processedMedia.height
          ? { aspectRatio: `${processedMedia.width} / ${processedMedia.height}` }
          : {}"
        alt="Image"
        @error="runtimeError = 'Image failed to load'"
      >

      <video
        v-else-if="processedMedia.mimeType?.startsWith('video/')"
        :src="processedMedia.src"
        class="h-auto max-w-[12rem] rounded-lg"
        alt="Video"
        autoplay loop muted playsinline
        @error="runtimeError = 'Sticker failed to load'"
      />

      <div
        v-else-if="processedMedia.type === 'sticker'"
        ref="tgsContainer"
        class="h-auto max-w-[12rem] rounded-lg"
      />
    </div>
  </template>
</template>
