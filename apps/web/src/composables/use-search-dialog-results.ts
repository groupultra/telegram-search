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
  cacheKey: Ref<string>
  keywordDebounced: Ref<string>
  scopedChatId: Ref<string | undefined>
}

interface SearchDialogResultsSnapshot {
  messagesHasMore: boolean
  photosHasMore: boolean
  photoResult: CoreRetrievalPhoto[]
  photosOffset: number
  searchResult: CoreRetrievalMessages[]
  messagesOffset: number
}

const searchDialogResultsCache = new Map<string, SearchDialogResultsSnapshot>()

function createEmptySnapshot(): SearchDialogResultsSnapshot {
  return {
    searchResult: [],
    photoResult: [],
    messagesHasMore: false,
    photosHasMore: false,
    messagesOffset: 0,
    photosOffset: 0,
  }
}

function createResultsSnapshot(cacheKey: string): SearchDialogResultsSnapshot {
  const cachedSnapshot = searchDialogResultsCache.get(cacheKey)
  if (!cachedSnapshot) {
    return createEmptySnapshot()
  }

  return {
    searchResult: [...cachedSnapshot.searchResult],
    photoResult: [...cachedSnapshot.photoResult],
    messagesHasMore: cachedSnapshot.messagesHasMore,
    photosHasMore: cachedSnapshot.photosHasMore,
    messagesOffset: cachedSnapshot.messagesOffset,
    photosOffset: cachedSnapshot.photosOffset,
  }
}

export function useSearchDialogResults({
  activeMode,
  cacheKey,
  keywordDebounced,
  scopedChatId,
}: UseSearchDialogResultsOptions) {
  const bridge = useBridge()
  const logger = useLogger('composables:search-dialog')

  const initialSnapshot = createResultsSnapshot(cacheKey.value)

  const isLoading = ref(false)
  const isLoadingMoreMessages = ref(false)
  const isLoadingMorePhotos = ref(false)
  const messagesHasMore = ref(initialSnapshot.messagesHasMore)
  const photosHasMore = ref(initialSnapshot.photosHasMore)
  const photoResult = ref<CoreRetrievalPhoto[]>(initialSnapshot.photoResult)
  const searchResult = ref<CoreRetrievalMessages[]>(initialSnapshot.searchResult)

  let messagesOffset = initialSnapshot.messagesOffset
  let photosOffset = initialSnapshot.photosOffset
  let requestSeq = 0

  const hasResults = computed(() => searchResult.value.length > 0 || photoResult.value.length > 0)
  const shouldRunSearch = computed(() => keywordDebounced.value.trim().length > 0 && activeMode.value !== 'commands')
  const showMessagesPanel = computed(() => activeMode.value === 'all' || activeMode.value === 'messages')
  const showPhotosPanel = computed(() => activeMode.value === 'all' || activeMode.value === 'photos')

  function persistSnapshot() {
    searchDialogResultsCache.set(cacheKey.value, {
      searchResult: [...searchResult.value],
      photoResult: [...photoResult.value],
      messagesHasMore: messagesHasMore.value,
      photosHasMore: photosHasMore.value,
      messagesOffset,
      photosOffset,
    })
  }

  watch(cacheKey, (nextCacheKey) => {
    requestSeq += 1
    const nextSnapshot = createResultsSnapshot(nextCacheKey)
    searchResult.value = nextSnapshot.searchResult
    photoResult.value = nextSnapshot.photoResult
    messagesHasMore.value = nextSnapshot.messagesHasMore
    photosHasMore.value = nextSnapshot.photosHasMore
    messagesOffset = nextSnapshot.messagesOffset
    photosOffset = nextSnapshot.photosOffset
    isLoading.value = false
    isLoadingMoreMessages.value = false
    isLoadingMorePhotos.value = false
  }, { flush: 'sync' })

  watch([keywordDebounced, activeMode, scopedChatId], ([newKeyword, mode]) => {
    if (newKeyword.length === 0 || mode === 'commands') {
      searchResult.value = []
      photoResult.value = []
      messagesHasMore.value = false
      photosHasMore.value = false
      messagesOffset = 0
      photosOffset = 0
      requestSeq += 1
      isLoading.value = false
      persistSnapshot()
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
      persistSnapshot()
    }).catch((error) => {
      logger.withError(error).warn('Search request failed or timed out')
      if (currentRequest === requestSeq) {
        isLoading.value = false
      }
    })
  })

  async function loadMoreMessages() {
    const currentKeyword = keywordDebounced.value.trim()
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
      persistSnapshot()
    }
    finally {
      if (currentRequest === requestSeq) {
        isLoadingMoreMessages.value = false
      }
    }
  }

  async function loadMorePhotos() {
    const currentKeyword = keywordDebounced.value.trim()
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
      persistSnapshot()
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

export function resetSearchDialogResultsCache() {
  searchDialogResultsCache.clear()
}
