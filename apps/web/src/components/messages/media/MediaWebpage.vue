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
    class="max-w-md cursor-pointer overflow-hidden border border-border rounded-lg bg-card shadow-sm transition-shadow hover:shadow-md"
    @click="processedMedia.webpageData?.url && openLink(processedMedia.webpageData.url)"
  >
    <!-- Preview image -->
    <div v-if="processedMedia.webpageData?.previewImage && !runtimeError" class="aspect-video bg-muted">
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
        <div class="h-4 w-4 flex items-center justify-center rounded-sm bg-muted">
          <div class="i-lucide-globe h-3 w-3 text-muted-foreground" />
        </div>
        <span class="text-xs text-muted-foreground">
          {{ processedMedia.webpageData?.siteName || processedMedia.webpageData?.displayUrl }}
        </span>
      </div>

      <!-- Title -->
      <h3 class="line-clamp-2 mb-1 text-sm text-foreground font-medium">
        {{ processedMedia.webpageData?.title }}
      </h3>

      <!-- Description -->
      <p v-if="processedMedia.webpageData?.description" class="line-clamp-2 text-xs text-muted-foreground">
        {{ processedMedia.webpageData.description }}
      </p>

      <!-- URL -->
      <div class="mt-2 truncate text-xs text-muted-foreground">
        {{ processedMedia.webpageData?.displayUrl }}
      </div>
    </div>
  </div>
</template>
