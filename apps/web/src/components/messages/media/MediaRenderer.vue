<script setup lang="ts">
import type { CoreMessageMediaFromBlob } from '@tg-search/core'
import type { CoreMessage } from '@tg-search/core/types'
import type { AnimationItem } from 'lottie-web'

import lottie from 'lottie-web'

import { hydrateMediaBlobWithCore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, watch } from 'vue'

import MediaWebpage from './MediaWebpage.vue'

const props = defineProps<{
  message: CoreMessage & {
    media?: CoreMessageMediaFromBlob[]
  }
}>()

const runtimeError = ref<string>()
const { debugMode } = storeToRefs(useSettingsStore())

const isMedia = computed(() => {
  return props.message.media?.length
})

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
  tgsAnimationData?: string
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
      // Webpage previews are not hydrated from Telegram raw media anymore.
      // Rely on content text and treat as a simple link/web preview.
      return {
        src: undefined,
        type: mediaItem.type,
      } satisfies ProcessedMedia
    }
    case 'photo': {
      return {
        src: mediaItem.blobUrl,
        type: mediaItem.type,
        mimeType: mediaItem.mimeType,
      } satisfies ProcessedMedia
    }
    default:
      return {
        src: mediaItem.blobUrl,
        type: mediaItem.type,
        mimeType: mediaItem.mimeType,
        tgsAnimationData: mediaItem.type === 'sticker' ? mediaItem.tgsAnimationData : undefined,
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

      void hydrateMediaBlobWithCore(mediaItem)
    },
    { immediate: true },
  )
}

const isLoading = computed(() => {
  return !processedMedia.value.src && !processedMedia.value.tgsAnimationData && isMedia.value
})

const finalError = computed(() => {
  return processedMedia.value.error || runtimeError.value
})

let animation: AnimationItem | null = null
const tgsContainer = ref<HTMLElement | null>(null)

watch(processedMedia, (newMedia) => {
  if (animation) {
    animation.destroy()
    animation = null
  }

  if (
    newMedia.type === 'sticker'
    && newMedia.mimeType === 'application/gzip'
    && newMedia.tgsAnimationData
    && tgsContainer.value
  ) {
    try {
      animation = lottie.loadAnimation({
        container: tgsContainer.value,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: JSON.parse(newMedia.tgsAnimationData),
      })
    }
    catch (e) {
      console.error('Failed to parse Lottie animation data', e)
      runtimeError.value = 'Sticker failed to load'
    }
  }
}, { flush: 'post' })

onUnmounted(() => {
  if (animation)
    animation.destroy()
})
</script>

<template>
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
  <div v-if="processedMedia.src || processedMedia.tgsAnimationData">
    <MediaWebpage
      v-if="processedMedia.type === 'webpage'"
      v-model:runtime-error="runtimeError"
      :processed-media="processedMedia"
    />

    <img
      v-else-if="processedMedia.mimeType?.startsWith('image/')"
      :src="processedMedia.src"
      class="h-auto max-w-xs rounded-lg"
      :style="processedMedia.width && processedMedia.height
        ? { aspectRatio: `${processedMedia.width} / ${processedMedia.height}` }
        : {}"
      alt="Image"
      @error="runtimeError = 'Image failed to load'"
    >

    <div
      v-else-if="processedMedia.mimeType === 'application/gzip'"
      ref="tgsContainer"
      class="h-auto max-w-[12rem] rounded-lg"
    />

    <video
      v-else-if="processedMedia.mimeType?.startsWith('video/')"
      :src="processedMedia.src"
      class="h-auto max-w-[12rem] rounded-lg"
      alt="Video"
      autoplay loop muted playsinline
      @error="runtimeError = 'Sticker failed to load'"
    />
  </div>
</template>
