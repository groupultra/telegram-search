<script setup lang="ts">
import type { ProcessedMedia } from './MediaRenderer.vue'

defineProps<{
  processedMedia: ProcessedMedia
}>()

const runtimeError = defineModel<string>('runtimeError')

function openLink(url: string) {
  window.open(url, '_blank')
}
</script>

<template>
  <div
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
</template>
