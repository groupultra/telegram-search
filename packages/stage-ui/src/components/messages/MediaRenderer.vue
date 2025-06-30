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
      webpageData: null,
    }
  }

  try {
    for (const mediaItem of props.message.media!) {
      if (!mediaItem.base64)
        continue

      const base64 = mediaItem.base64
      switch (mediaItem.type) {
        case 'photo':
          return {
            src: base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`,
            type: mediaItem.type,
            error: null,
            webpageData: null,
          }
        case 'sticker':
          return {
            src: base64.startsWith('data:') ? base64 : `data:video/webm;base64,${base64}`,
            type: mediaItem.type,
            error: null,
            webpageData: null,
          }
        case 'webpage': {
          // 处理网页预览
          const apiMedia = mediaItem.apiMedia as any
          const webpage = apiMedia?.webpage

          if (webpage) {
            // 预览图已经通过base64提供
            const previewImage = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`

            return {
              src: webpage.url,
              type: mediaItem.type,
              error: null,
              webpageData: {
                title: webpage.title,
                description: webpage.description,
                siteName: webpage.siteName,
                url: webpage.url,
                displayUrl: webpage.displayUrl,
                previewImage,
              },
            }
          }
          break
        }
        default:
          return {
            src: base64.startsWith('data:') ? base64 : `data:application/octet-stream;base64,${base64}`,
            type: mediaItem.type,
            error: null,
            webpageData: null,
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
      webpageData: null,
    }
  }

  return {
    src: null,
    type: 'unknown' as CoreMessageMediaTypes,
    error: null,
    webpageData: null,
  }
})

const isLoading = computed(() => {
  return !processedMedia.value.src && isMedia.value && !processedMedia.value.error && !runtimeError.value
})

const finalError = computed(() => {
  return processedMedia.value.error || runtimeError.value
})

function openLink(url: string) {
  window.open(url, '_blank')
}
</script>

<template>
  <!-- Show text content if available -->
  <div v-if="message.content && message.media?.length === 0 && message.media?.[0]?.type !== 'webpage'" class="mb-2">
    {{ message.content }}
  </div>
  <a v-else :href="message.content" target="_blank">
    {{ message.content }}
  </a>

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
    <!-- 网页预览卡片 -->
    <div
      v-if="processedMedia.type === 'webpage'"
      class="max-w-md cursor-pointer overflow-hidden border border-gray-200 rounded-lg shadow-sm transition-shadow dark:border-gray-700 hover:shadow-md"
      @click="processedMedia.webpageData?.url && openLink(processedMedia.webpageData.url)"
    >
      <!-- 预览图 -->
      <div v-if="processedMedia.webpageData?.previewImage" class="aspect-video bg-gray-100 dark:bg-gray-800">
        <img
          :src="processedMedia.webpageData.previewImage"
          class="h-full w-full object-cover"
          :alt="processedMedia.webpageData.title || 'Webpage Preview'"
          @error="runtimeError = 'Preview image failed to load'"
        >
      </div>

      <!-- 网页信息 -->
      <div class="p-3">
        <!-- 网站名称和域名 -->
        <div class="mb-2 flex items-center gap-2">
          <div class="h-4 w-4 flex items-center justify-center rounded-sm bg-gray-300 dark:bg-gray-600">
            <div class="i-lucide-globe h-3 w-3 text-gray-600 dark:text-gray-400" />
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ processedMedia.webpageData?.siteName || processedMedia.webpageData?.displayUrl }}
          </span>
        </div>

        <!-- 标题 -->
        <h3 class="line-clamp-2 mb-1 text-sm text-gray-900 font-medium dark:text-gray-100">
          {{ processedMedia.webpageData?.title }}
        </h3>

        <!-- 描述 -->
        <p v-if="processedMedia.webpageData?.description" class="line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
          {{ processedMedia.webpageData.description }}
        </p>

        <!-- URL -->
        <div class="mt-2 truncate text-xs text-blue-600 dark:text-blue-400">
          {{ processedMedia.webpageData?.displayUrl }}
        </div>
      </div>
    </div>

    <!-- Images -->
    <img
      v-else-if="processedMedia.type === 'photo'"
      :src="processedMedia.src"
      class="h-auto max-w-full max-w-xs rounded-lg"
      alt="Media content"
      @error="runtimeError = 'Image failed to load'"
    >

    <!-- Videos/Stickers -->
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
