import type { CoreRetrievalMessages, CoreRetrievalPhoto } from '@tg-search/core/types'
import type { Ref } from 'vue'

import type { SearchMode } from '../utils/search-dialog'

import { useLogger } from '@guiiai/logg'
import { useBridge, waitForEventWithTimeout } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'
import { computed, ref, watch } from 'vue'

const SEARCH_LIMIT = 10

function createRequestId() {
  return `search:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

interface UseSearchDialogResultsOptions {
  activeMode: Ref<SearchMode>
  keyword: Ref<string>
  keywordDebounced: Ref<string>
  scopedChatId: Ref<string | undefined>
}

export function useSearchDialogResults({
  activeMode,
  keyword,
  keywordDebounced,
  scopedChatId,
}: UseSearchDialogResultsOptions) {
  const bridge = useBridge()
  const logger = useLogger('composables:search-dialog')

  const isLoading = ref(false)
  const isLoadingMoreMessages = ref(false)
  const isLoadingMorePhotos = ref(false)
  const messagesHasMore = ref(false)
  const photosHasMore = ref(false)
  const photoResult = ref<CoreRetrievalPhoto[]>([])
  const searchResult = ref<CoreRetrievalMessages[]>([])

  let messagesOffset = 0
  let photosOffset = 0
  let requestSeq = 0

  const settledKeyword = computed(() => {
    const currentKeyword = keyword.value.trim()
    const debouncedKeyword = keywordDebounced.value.trim()

    return currentKeyword === debouncedKeyword ? debouncedKeyword : ''
  })
  const hasResults = computed(() => searchResult.value.length > 0 || photoResult.value.length > 0)
  const shouldRunSearch = computed(() => settledKeyword.value.length > 0 && activeMode.value !== 'commands')
  const showMessagesPanel = computed(() => activeMode.value === 'all' || activeMode.value === 'messages')
  const showPhotosPanel = computed(() => activeMode.value === 'all' || activeMode.value === 'photos')

  watch([settledKeyword, activeMode, scopedChatId], ([newKeyword, mode]) => {
    if (newKeyword.length === 0 || mode === 'commands') {
      searchResult.value = []
      photoResult.value = []
      messagesHasMore.value = false
      photosHasMore.value = false
      messagesOffset = 0
      photosOffset = 0
      requestSeq += 1
      isLoading.value = false
      return
    }

    const currentRequest = ++requestSeq
    isLoading.value = true
    messagesOffset = 0
    photosOffset = 0

    const messageRequestId = createRequestId()
    const photoRequestId = createRequestId()

    bridge.sendEvent(CoreEventType.StorageSearchMessages, {
      requestId: messageRequestId,
      chatId: scopedChatId.value,
      content: newKeyword,
      useVector: true,
      pagination: {
        limit: SEARCH_LIMIT,
        offset: 0,
      },
    })

    bridge.sendEvent(CoreEventType.StorageSearchPhotos, {
      requestId: photoRequestId,
      content: newKeyword,
      useVector: true,
      pagination: {
        limit: SEARCH_LIMIT,
        offset: 0,
      },
      chatIds: scopedChatId.value ? [scopedChatId.value] : undefined,
    })

    Promise.all([
      waitForEventWithTimeout(bridge.waitForEvent(CoreEventType.StorageSearchMessagesData, data => data.requestId === messageRequestId)),
      waitForEventWithTimeout(bridge.waitForEvent(CoreEventType.StorageSearchPhotosData, data => data.requestId === photoRequestId)),
    ]).then(([messagesData, photosData]) => {
      if (currentRequest !== requestSeq) {
        return
      }

      searchResult.value = messagesData.messages
      photoResult.value = photosData.photos
      messagesHasMore.value = messagesData.hasMore
      photosHasMore.value = photosData.hasMore
      messagesOffset = messagesData.messages.length
      photosOffset = photosData.photos.length
      isLoading.value = false
    }).catch((error) => {
      logger.withError(error).warn('Search request failed or timed out')
      if (currentRequest === requestSeq) {
        isLoading.value = false
      }
    })
  }, { immediate: true })

  async function loadMoreMessages() {
    const currentKeyword = settledKeyword.value
    if (!currentKeyword || isLoadingMoreMessages.value || !messagesHasMore.value || activeMode.value === 'commands') {
      return
    }

    const currentRequest = ++requestSeq
    isLoadingMoreMessages.value = true
    const requestId = createRequestId()

    bridge.sendEvent(CoreEventType.StorageSearchMessages, {
      requestId,
      chatId: scopedChatId.value,
      content: currentKeyword,
      useVector: true,
      pagination: {
        limit: SEARCH_LIMIT,
        offset: messagesOffset,
      },
    })

    try {
      const result = await waitForEventWithTimeout(bridge.waitForEvent(CoreEventType.StorageSearchMessagesData, data => data.requestId === requestId))
      if (currentRequest !== requestSeq) {
        return
      }

      searchResult.value = [...searchResult.value, ...result.messages]
      messagesHasMore.value = result.hasMore
      messagesOffset += result.messages.length
    }
    finally {
      if (currentRequest === requestSeq) {
        isLoadingMoreMessages.value = false
      }
    }
  }

  async function loadMorePhotos() {
    const currentKeyword = settledKeyword.value
    if (!currentKeyword || isLoadingMorePhotos.value || !photosHasMore.value || activeMode.value === 'commands') {
      return
    }

    const currentRequest = ++requestSeq
    isLoadingMorePhotos.value = true
    const requestId = createRequestId()

    bridge.sendEvent(CoreEventType.StorageSearchPhotos, {
      requestId,
      content: currentKeyword,
      useVector: true,
      pagination: {
        limit: SEARCH_LIMIT,
        offset: photosOffset,
      },
      chatIds: scopedChatId.value ? [scopedChatId.value] : undefined,
    })

    try {
      const result = await waitForEventWithTimeout(bridge.waitForEvent(CoreEventType.StorageSearchPhotosData, data => data.requestId === requestId))
      if (currentRequest !== requestSeq) {
        return
      }

      photoResult.value = [...photoResult.value, ...result.photos]
      photosHasMore.value = result.hasMore
      photosOffset += result.photos.length
    }
    finally {
      if (currentRequest === requestSeq) {
        isLoadingMorePhotos.value = false
      }
    }
  }

  return {
    hasResults,
    isLoading,
    isLoadingMoreMessages,
    isLoadingMorePhotos,
    loadMoreMessages,
    loadMorePhotos,
    messagesHasMore,
    photoResult,
    photosHasMore,
    searchResult,
    shouldRunSearch,
    showMessagesPanel,
    showPhotosPanel,
  }
}
