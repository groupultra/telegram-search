<script setup lang="ts">
import type { CoreMessageMediaFromBlob } from '@tg-search/core'
import type { CoreMessage } from '@tg-search/core/types'
import type { AnimationItem } from 'lottie-web'

import lottie from 'lottie-web'
import { computed, onUnmounted, ref, watch } from 'vue'

import MediaWebpage from './MediaWebpage.vue'

const props = defineProps<{
  message: CoreMessage & {
    media?: CoreMessageMediaFromBlob[]
  }
}>()

const runtimeError = ref<string>()

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
}

const processedMedia = computed<ProcessedMedia>(() => {
  if (isMedia.value) {
    for (const mediaItem of props.message.media!) {
      switch (mediaItem.type) {
        case 'webpage': {
          // TODO: add webpage to core media
          const webpage = (mediaItem.apiMedia as any)?.webpage
          if (!webpage)
            continue

          return {
            src: webpage.url,
            type: mediaItem.type,
            webpageData: {
              title: webpage.title,
              description: webpage.description,
              siteName: webpage.siteName,
              url: webpage.url,
              displayUrl: webpage.displayUrl,
              previewImage: mediaItem.blobUrl,
            },
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
    }
  }

  return {
    src: undefined,
    type: 'unknown',
  } satisfies ProcessedMedia
})

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
  <div v-if="message.content" class="mb-2 text-primary-900 dark:text-gray-100">
    {{ message.content }}
  </div>

  <!-- Loading state -->
  <div v-if="isLoading" class="h-20 w-20 flex items-center justify-center">
    <div class="h-20 w-20 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
  </div>

  <!-- Error state -->
  <div v-if="finalError" class="flex items-center gap-2 rounded bg-red-100 p-2 dark:bg-red-900">
    <div class="i-lucide-alert-circle h-4 w-4 text-red-500" />
    <span class="text-sm text-red-700 dark:text-red-300">{{ finalError }}</span>
  </div>

  <!-- Media content -->
  <div v-if="processedMedia.src || processedMedia.tgsAnimationData">
    <MediaWebpage
      v-if="processedMedia.type === 'webpage'" v-model:runtime-error="runtimeError"
      :processed-media="processedMedia"
    />

    <img
      v-else-if="processedMedia.mimeType?.startsWith('image/')"
      :src="processedMedia.src" class="h-auto max-w-xs rounded-lg" alt="Media content"
      @error="runtimeError = 'Image failed to load'"
    >

    <video
      v-else-if="processedMedia.mimeType?.startsWith('video/')" :src="processedMedia.src"
      class="h-auto max-w-[12rem] rounded-lg" alt="Media content" autoplay loop muted playsinline
      @error="runtimeError = 'Sticker failed to load'"
    />

    <div
      v-else-if="processedMedia.mimeType === 'application/gzip'" ref="tgsContainer"
      class="h-auto max-w-[12rem] rounded-lg"
    />
  </div>
</template>
