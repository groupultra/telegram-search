<script setup lang="ts">
import type { CoreMessageMediaFromBlob } from '@tg-search/core'
import type { CoreMessage } from '@tg-search/core/types'
import type { AnimationItem } from 'lottie-web'

import lottie from 'lottie-web'
import pako from 'pako'

import { useLogger } from '@guiiai/logg'
import { getMediaBinaryProvider, hydrateMediaBlobWithCore, useBridge, useSettingsStore } from '@tg-search/client'
import { models } from '@tg-search/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import MediaWebpage from './MediaWebpage.vue'

import { IS_CORE_MODE } from '../../../constants'

const props = defineProps<{
  message: CoreMessage & {
    media?: CoreMessageMediaFromBlob[]
  }
}>()

const runtimeError = ref<string>()
const { debugMode } = storeToRefs(useSettingsStore())
const bridge = useBridge()
const isReprocessing = ref(false)
const hasPermanentError = ref(false)
const currentSrc = ref<string | undefined>(undefined)
const hasReprocessedCurrentSrc = ref(false)

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
    case 'webpage':
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

    case 'photo':
    case 'sticker':
      return {
        src: mediaItem.blobUrl,
        type: mediaItem.type,
        mimeType: mediaItem.mimeType,
      } satisfies ProcessedMedia

    default:
      return {
        src: undefined,
        type: 'unknown',
      } satisfies ProcessedMedia
  }
})

// In With Core mode, lazily hydrate media blobs from the embedded database
// only when this component is mounted and has a media item to render.
if (IS_CORE_MODE) {
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

watch(
  () => processedMedia.value.src,
  (newSrc) => {
    // When media source changes (e.g. after successful re-process),
    // reset error and reprocess state so the new URL can be loaded normally.
    if (newSrc !== currentSrc.value) {
      currentSrc.value = newSrc
      hasReprocessedCurrentSrc.value = false
      hasPermanentError.value = false
      runtimeError.value = undefined
      isReprocessing.value = false
    }
  },
  { immediate: true },
)

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
          useLogger('media').withError(error).error('Failed to fetch Lottie animation data')
          runtimeError.value = 'Sticker failed to load'
        })
    }
  })
})

onUnmounted(() => {
  if (animation)
    animation.destroy()
})

function sendReprocessForCurrentMessage(mediaType: 'Image' | 'Sticker') {
  if (!props.message.chatId || !props.message.platformMessageId) {
    useLogger('media').error('Missing chatId or platformMessageId for reprocessing')
    runtimeError.value = `${mediaType} failed to load`
    return
  }

  const messageId = Number.parseInt(props.message.platformMessageId, 10)
  if (Number.isNaN(messageId)) {
    useLogger('media').error(`Invalid message ID: ${props.message.platformMessageId}`)
    runtimeError.value = `${mediaType} failed to load`
    return
  }

  bridge.sendEvent('message:reprocess', {
    chatId: props.message.chatId,
    messageIds: [messageId],
    resolvers: ['media'],
  })
}

async function handleMediaError(event: Event, mediaType: 'Image' | 'Sticker') {
  useLogger('media').withFields({ mediaType, event }).error(`${mediaType} failed to load`)

  const src = processedMedia.value.src

  if (!src) {
    hasPermanentError.value = true
    runtimeError.value = `${mediaType} failed to load`
    return
  }

  // If we've already permanently failed for this src, do nothing.
  if (hasPermanentError.value) {
    return
  }

  // Trigger a one-time re-process to re-download missing media.
  isReprocessing.value = true
  hasReprocessedCurrentSrc.value = true
  hasPermanentError.value = true
  runtimeError.value = `${mediaType} not found, re-downloading...`

  sendReprocessForCurrentMessage(mediaType)
}

function handleImageError(event: Event) {
  void handleMediaError(event, 'Image')
}

function handleStickerError(event: Event) {
  void handleMediaError(event, 'Sticker')
}

function handlePlaceholderClick() {
  // Determine a reasonable media type label for retry messaging
  const mediaType: 'Image' | 'Sticker'
    = processedMedia.value.type === 'photo' ? 'Image' : 'Sticker'

  runtimeError.value = `Retrying ${mediaType.toLowerCase()} download...`
  sendReprocessForCurrentMessage(mediaType)
}
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

  <!-- Error info (debug only) -->
  <div v-if="finalError && debugMode" class="mt-1 flex items-center gap-2 rounded bg-red-100 p-2 dark:bg-red-900">
    <div class="i-lucide-alert-circle h-4 w-4 text-red-500" />
    <span class="text-sm text-red-700 dark:text-red-300">{{ finalError }}</span>
  </div>

  <!-- Media content / placeholder -->
  <template v-if="processedMedia.type !== 'unknown'">
    <!-- Normal media rendering when no permanent error -->
    <div v-if="processedMedia.src && !hasPermanentError">
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
        @error="handleImageError"
      >

      <video
        v-else-if="processedMedia.mimeType?.startsWith('video/')"
        :src="processedMedia.src"
        class="h-auto max-w-[12rem] rounded-lg"
        alt="Video"
        autoplay loop muted playsinline
        @error="handleStickerError"
      />

      <div
        v-else-if="processedMedia.type === 'sticker'"
        ref="tgsContainer"
        class="h-auto max-w-[12rem] rounded-lg"
      />
    </div>

    <!-- Fallback placeholder when media has permanently failed -->
    <div
      v-else-if="hasPermanentError"
      class="h-48 max-w-xs flex cursor-pointer items-center justify-center border border-gray-300 rounded-lg border-dashed bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-500"
      @click="handlePlaceholderClick"
    >
      <div class="flex flex-col items-center gap-1">
        <div class="i-lucide-image-off h-6 w-6" />
        <span class="text-xs">Media unavailable. Click to retry.</span>
      </div>
    </div>
  </template>
</template>
