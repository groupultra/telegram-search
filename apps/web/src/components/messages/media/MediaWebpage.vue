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
    class="max-w-md cursor-pointer overflow-hidden border border-line-2 rounded-lg bg-container shadow-sm transition-shadow hover:shadow-popup"
    @click="processedMedia.webpageData?.url && openLink(processedMedia.webpageData.url)"
  >
    <!-- Preview image -->
    <div v-if="processedMedia.webpageData?.previewImage && !runtimeError" class="aspect-video bg-fill-3">
      <img
        :src="processedMedia.webpageData.previewImage"
        class="h-full w-full object-cover"
        :alt="processedMedia.webpageData.title || 'Webpage Preview'"
        @error="runtimeError = 'Preview image failed to load'"
      >
    </div>

    <!-- Webpage information -->
    <div class="p-3">
      <!-- Website name and domain -->
      <div class="mb-2 flex items-center gap-2">
        <div class="h-4 w-4 flex items-center justify-center rounded-sm bg-fill-3">
          <div class="i-lucide-globe h-3 w-3 text-fg-3" />
        </div>
        <span class="text-xs text-fg-3">
          {{ processedMedia.webpageData?.siteName || processedMedia.webpageData?.displayUrl }}
        </span>
      </div>

      <!-- Title -->
      <h3 class="line-clamp-2 mb-1 text-sm text-fg font-medium">
        {{ processedMedia.webpageData?.title }}
      </h3>

      <!-- Description -->
      <p v-if="processedMedia.webpageData?.description" class="line-clamp-2 text-xs text-fg-3">
        {{ processedMedia.webpageData.description }}
      </p>

      <!-- URL -->
      <div class="mt-2 truncate text-xs text-fg-3">
        {{ processedMedia.webpageData?.displayUrl }}
      </div>
    </div>
  </div>
</template>
