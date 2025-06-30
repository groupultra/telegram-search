<script setup lang="ts">
import type { CoreMessage, CoreMessageMediaTypes } from '@tg-search/core/types'

import { computed, ref } from 'vue'

import MediaWebpage from './MediaWebpage.vue'

const props = defineProps<{
  message: CoreMessage
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
  type: CoreMessageMediaTypes
  error?: string
  webpageData?: WebpageData
}

const processedMedia = computed<ProcessedMedia>(() => {
  if (isMedia.value) {
    for (const mediaItem of props.message.media!) {
      if (!mediaItem.base64)
        continue

      switch (mediaItem.type) {
        case 'photo':
          return {
            src: mediaItem.base64?.startsWith('data:') ? mediaItem.base64 : `data:image/jpeg;base64,${mediaItem.base64}`,
            type: mediaItem.type,
          } satisfies ProcessedMedia
        case 'sticker':
          return {
            src: mediaItem.base64?.startsWith('data:') ? mediaItem.base64 : `data:video/webm;base64,${mediaItem.base64}`,
            type: mediaItem.type,
          } satisfies ProcessedMedia
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
              previewImage: mediaItem.base64?.startsWith('data:') ? mediaItem.base64 : `data:image/jpeg;base64,${mediaItem.base64}`,
            },
          } satisfies ProcessedMedia
        }
        default:
          return {
            src: mediaItem.base64?.startsWith('data:') ? mediaItem.base64 : `data:application/octet-stream;base64,${mediaItem.base64}`,
            type: mediaItem.type,
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
  return !processedMedia.value.src && isMedia.value
})

const finalError = computed(() => {
  return processedMedia.value.error || runtimeError.value
})
</script>

<template>
  <div v-if="message.content" class="mb-2">
    {{ message.content }}
  </div>

  <!-- Loading state -->
  <div v-if="isLoading" class="flex items-center gap-2">
    <div class="i-lucide-loader-circle h-4 w-4 animate-spin" />
    <span class="text-xs text-complementary-600">处理媒体中...</span>
  </div>

  <!-- Error state -->
  <div v-if="finalError" class="flex items-center gap-2 rounded bg-red-100 p-2 dark:bg-red-900">
    <div class="i-lucide-alert-circle h-4 w-4 text-red-500" />
    <span class="text-sm text-red-700 dark:text-red-300">{{ finalError }}</span>
  </div>

  <!-- Media content -->
  <div v-if="processedMedia.src">
    <MediaWebpage
      v-if="processedMedia.type === 'webpage'"
      v-model:runtime-error="runtimeError"
      :processed-media="processedMedia"
    />

    <img
      v-if="processedMedia.type === 'photo'"
      :src="processedMedia.src"
      class="h-auto max-w-xs rounded-lg"
      alt="Media content"
      @error="runtimeError = 'Image failed to load'"
    >

    <video
      v-else-if="processedMedia.type === 'sticker'"
      :src="processedMedia.src"
      class="h-auto max-w-xs rounded-lg"
      alt="Media content"

      autoplay loop muted playsinline
      @error="runtimeError = 'Video failed to load'"
    />

    <div
      v-else
      class="flex items-center gap-2 rounded bg-gray-100 p-3 dark:bg-gray-800"
    >
      <div class="i-lucide-file h-5 w-5" />
      <div class="flex-1">
        <span class="text-sm font-medium">文档文件</span>
        <div class="text-xs text-gray-500">
          点击下载
        </div>
      </div>
      <a
        :href="processedMedia.src"
        :download="`file_${message.platformMessageId}`"
        class="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
      >
        下载
      </a>
    </div>
  </div>
</template>
