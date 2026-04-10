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
  // Separate sequence counters so that message and photo pagination don't
  // invalidate each other. A new keyword search bumps both to discard any
  // in-flight load-more requests.
  let messagesSeq = 0
  let photosSeq = 0

  // Only trigger search when the debounced value has caught up with the current input,
  // preventing stale keyword searches after chat switches restore a cached keyword.
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
    // Bump sequence counters first so any in-flight load-more requests
    // become stale, then forcibly clear their loading flags so they can't
    // block future pagination.
    messagesSeq += 1
    photosSeq += 1
    isLoadingMoreMessages.value = false
    isLoadingMorePhotos.value = false

    if (newKeyword.length === 0 || mode === 'commands') {
      searchResult.value = []
      photoResult.value = []
      messagesHasMore.value = false
      photosHasMore.value = false
      messagesOffset = 0
      photosOffset = 0
      isLoading.value = false
      return
    }

    const currentMsgSeq = messagesSeq
    const currentPhotoSeq = photosSeq
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
      if (currentMsgSeq !== messagesSeq || currentPhotoSeq !== photosSeq) {
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
      if (currentMsgSeq === messagesSeq && currentPhotoSeq === photosSeq) {
        isLoading.value = false
      }
    })
  }, { immediate: true })

  async function loadMoreMessages() {
    const currentKeyword = settledKeyword.value
    if (!currentKeyword || isLoadingMoreMessages.value || !messagesHasMore.value || activeMode.value === 'commands') {
      return
    }

    const currentSeq = ++messagesSeq
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
      if (currentSeq !== messagesSeq) {
        return
      }

      searchResult.value = [...searchResult.value, ...result.messages]
      messagesHasMore.value = result.hasMore
      messagesOffset += result.messages.length
    }
    catch (error) {
      logger.withError(error).warn('Load more messages failed')
      if (currentSeq === messagesSeq) {
        // Stop claiming more data exists so the auto-load watcher in
        // SearchDialog does not retry the same failing request forever.
        messagesHasMore.value = false
      }
    }
    finally {
      if (currentSeq === messagesSeq) {
        isLoadingMoreMessages.value = false
      }
    }
  }

  async function loadMorePhotos() {
    const currentKeyword = settledKeyword.value
    if (!currentKeyword || isLoadingMorePhotos.value || !photosHasMore.value || activeMode.value === 'commands') {
      return
    }

    const currentSeq = ++photosSeq
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
      if (currentSeq !== photosSeq) {
        return
      }

      photoResult.value = [...photoResult.value, ...result.photos]
      photosHasMore.value = result.hasMore
      photosOffset += result.photos.length
    }
    catch (error) {
      logger.withError(error).warn('Load more photos failed')
      if (currentSeq === photosSeq) {
        photosHasMore.value = false
      }
    }
    finally {
      if (currentSeq === photosSeq) {
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
