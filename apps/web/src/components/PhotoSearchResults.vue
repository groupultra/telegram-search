<script setup lang="ts">
import type { CoreMessageMediaFromBlob, CoreRetrievalPhoto } from '@tg-search/core/types'

import { formatMessageTimestamp, getMediaBinaryProvider, hydrateMediaBlobWithCore } from '@tg-search/client'
import { models } from '@tg-search/core'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import EntityAvatar from './avatar/EntityAvatar.vue'

const props = withDefaults(defineProps<{
  photos: CoreRetrievalPhoto[]
  hasMore?: boolean
  isLoadingMore?: boolean
}>(), {
  hasMore: false,
  isLoadingMore: false,
})

const emit = defineEmits<{
  loadMore: []
}>()

const { t } = useI18n()
const router = useRouter()
const scrollRef = ref<HTMLElement | null>(null)

type ProcessedRetrievalPhoto = CoreRetrievalPhoto & {
  blobUrl?: string
}

const processedPhotos = ref<ProcessedRetrievalPhoto[]>([])

watch(() => props.photos, async (newPhotos) => {
  // Initialize with existing data
  processedPhotos.value = newPhotos.map(p => ({ ...p }))

  // Hydrate blobs for each photo
  for (const photo of processedPhotos.value) {
    if (!photo.id)
      continue

    const mediaItem = {
      type: 'photo',
      queryId: photo.id,
      mimeType: photo.mimeType,
      // Hydration path only uses queryId/type, keep a stable placeholder platformId.
      platformId: 'mock',
    } as CoreMessageMediaFromBlob

    try {
      await hydrateMediaBlobWithCore(
        mediaItem,
        models.photoModels,
        models.stickerModels,
        getMediaBinaryProvider(),
      )

      if (mediaItem.blobUrl) {
        photo.blobUrl = mediaItem.blobUrl
      }
    }
    catch (e) {
      console.error('Failed to hydrate photo', e)
    }
  }
}, { immediate: true, deep: true })

// Navigate to the source message that contains this photo.
function navigateToPhoto(photo: CoreRetrievalPhoto) {
  if (!photo.chatId || !photo.platformMessageId) {
    return
  }

  router.push({
    path: `/chat/${photo.chatId}`,
    query: {
      messageId: photo.platformMessageId,
      messageUuid: photo.messageId,
    },
  })
}

// Keep timestamp formatting consistent with MessageList.
function getPhotoTimestamp(photo: CoreRetrievalPhoto) {
  // createdAt is stored in milliseconds while formatter expects seconds.
  return formatMessageTimestamp(Math.floor(photo.createdAt / 1000))
}

function onScroll() {
  const el = scrollRef.value
  if (!el || !props.hasMore || props.isLoadingMore)
    return

  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distanceFromBottom < 200) {
    emit('loadMore')
  }
}

onMounted(() => {
  scrollRef.value?.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  scrollRef.value?.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div ref="scrollRef" class="h-full overflow-y-auto">
    <ul class="flex flex-col">
      <li
        v-for="photo in processedPhotos"
        :key="photo.id"
        class="group relative flex cursor-pointer items-start gap-3 border-b p-3 transition-all duration-200 ease-in-out last:border-b-0 dark:border-gray-700 active:bg-neutral-200/50 hover:bg-neutral-100/50 dark:active:bg-gray-700/50 dark:hover:bg-gray-800/50"
        tabindex="0"
        @keydown.enter="navigateToPhoto(photo)"
        @click="navigateToPhoto(photo)"
      >
        <!-- Left: preview/avatar -->
        <div class="shrink-0 pt-0.5">
          <img
            v-if="photo.blobUrl"
            :src="photo.blobUrl"
            class="h-10 w-10 rounded-full object-cover"
            alt="Result thumbnail"
          >
          <EntityAvatar
            v-else-if="photo.chatId"
            :id="photo.chatId"
            entity="other"
            entity-type="chat"
            :name="photo.chatName || ''"
            size="md"
          />
          <!-- Fallback icon when preview and avatar are unavailable -->
          <div v-else class="h-10 w-10 flex items-center justify-center rounded-full bg-primary/10">
            <span class="i-lucide-image h-5 w-5 text-primary" />
          </div>
        </div>

        <!-- Right: metadata -->
        <div class="min-w-0 flex-1">
          <!-- Title row -->
          <div class="flex items-baseline gap-2">
            <span class="truncate text-sm text-gray-900 font-semibold dark:text-gray-100">
              {{ photo.chatName || t('common.unknownChat') }}
            </span>
            <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
              {{ getPhotoTimestamp(photo) }}
            </span>
          </div>

          <!-- Description -->
          <div v-if="photo.description" class="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-400">
            {{ photo.description }}
          </div>

          <!-- Footer metadata -->
          <div v-if="photo.platformMessageId" class="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span class="i-lucide-hash h-3 w-3" />
            <span>{{ photo.platformMessageId }}</span>
          </div>
        </div>
      </li>

      <!-- Loading more indicator -->
      <li v-if="isLoadingMore" class="flex items-center justify-center py-4">
        <span class="i-lucide-loader-circle animate-spin text-xl text-primary" />
      </li>
    </ul>
  </div>
</template>
