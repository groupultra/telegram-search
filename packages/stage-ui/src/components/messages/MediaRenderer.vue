<script setup lang="ts">
import type { CoreMessage, CoreMessageMediaTypes } from '@tg-search/core/types'

import { computed, ref } from 'vue'

const props = defineProps<{
  message: CoreMessage
}>()

const runtimeError = ref<string | null>(null)

const isMedia = computed(() => {
  return props.message.media?.length
})

const processedMedia = computed(() => {
  if (!isMedia.value) {
    return {
      src: null,
      type: 'unknown' as CoreMessageMediaTypes,
      error: null,
    }
  }

  try {
    for (const mediaItem of props.message.media!) {
      if (!mediaItem.base64)
        continue

      switch (mediaItem.type) {
        case 'photo':
          return {
            src: mediaItem.base64.startsWith('data:') ? mediaItem.base64 : `data:image/jpeg;base64,${mediaItem.base64}`,
            type: mediaItem.type,
            error: null,
          }
        case 'sticker':
          return {
          // video/webm
            src: mediaItem.base64.startsWith('data:') ? mediaItem.base64 : `data:video/webm;base64,${mediaItem.base64}`,
            type: mediaItem.type,
            error: null,
          }
        default:
          return {
            src: mediaItem.base64.startsWith('data:') ? mediaItem.base64 : `data:application/octet-stream;base64,${mediaItem.base64}`,
            type: mediaItem.type,
            error: null,
          }
      }
    }
  }
  catch (err) {
    console.error('Error processing media:', err)
    return {
      src: null,
      type: 'unknown' as CoreMessageMediaTypes,
      error: 'Failed to process media',
    }
  }

  return {
    src: null,
    type: 'unknown' as CoreMessageMediaTypes,
    error: null,
  }
})

const isLoading = computed(() => {
  return !processedMedia.value.src && isMedia.value && !processedMedia.value.error && !runtimeError.value
})

const finalError = computed(() => {
  return processedMedia.value.error || runtimeError.value
})
</script>

<template>
  <!-- Show text content if available -->
  <div v-if="message.content" class="mb-2">
    {{ message.content }}
  </div>

  <!-- Loading state -->
  <div v-if="isLoading" class="flex items-center gap-2">
    <div class="i-lucide-loader-circle h-4 w-4 animate-spin" />
    <span class="text-xs text-complementary-600">处理媒体中...</span>
  </div>

  <!-- Error state -->
  <div v-else-if="finalError" class="flex items-center gap-2 rounded bg-red-100 p-2 dark:bg-red-900">
    <div class="i-lucide-alert-circle h-4 w-4 text-red-500" />
    <span class="text-sm text-red-700 dark:text-red-300">{{ finalError }}</span>
  </div>

  <!-- Media content -->
  <div v-else-if="processedMedia.src">
    <!-- Images -->
    <img
      v-if="processedMedia.type === 'photo'"
      :src="processedMedia.src"
      class="h-auto max-w-full max-w-xs rounded-lg"
      alt="Media content"
      @error="runtimeError = 'Image failed to load'"
    >
    <video
      v-else-if="processedMedia.type === 'sticker'"
      :src="processedMedia.src"
      class="h-auto max-w-full max-w-xs rounded-lg"
      alt="Media content"

      autoplay loop muted playsinline
      @error="runtimeError = 'Video failed to load'"
    />

    <!-- Others -->
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
