import type { CoreRetrievalMessages } from '@tg-search/core/types'

import { useBridge } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'
import { useDebounce } from '@vueuse/core'
import { ref, watch } from 'vue'

interface UseMessageSearchOptions {
  chatId?: string
  debounceMs?: number
  limit?: number
  useVector?: boolean
}

const MESSAGE_SEARCH_DEFAULTS = {
  debounceMs: 1000,
  limit: 10,
  useVector: true,
} as const

export function useMessageSearch(options: UseMessageSearchOptions = {}) {
  const bridge = useBridge()
  const debounceMs = options.debounceMs ?? MESSAGE_SEARCH_DEFAULTS.debounceMs
  const limit = options.limit ?? MESSAGE_SEARCH_DEFAULTS.limit
  const useVector = options.useVector ?? MESSAGE_SEARCH_DEFAULTS.useVector

  const keyword = ref<string>('')
  const keywordDebounced = useDebounce(keyword, debounceMs)
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const hasMore = ref(false)
  const searchResult = ref<CoreRetrievalMessages[]>([])

  let requestSeq = 0
  let currentOffset = 0

  watch(keywordDebounced, async (newKeyword) => {
    const nextKeyword = newKeyword.trim()

    if (nextKeyword.length === 0) {
      requestSeq += 1
      isLoading.value = false
      isLoadingMore.value = false
      hasMore.value = false
      searchResult.value = []
      currentOffset = 0
      return
    }

    const currentRequest = ++requestSeq
    isLoading.value = true
    currentOffset = 0

    bridge.sendEvent(CoreEventType.StorageSearchMessages, {
      chatId: options.chatId,
      content: nextKeyword,
      useVector,
      pagination: {
        limit,
        offset: 0,
      },
    })

    try {
      const result = await bridge.waitForEvent(CoreEventType.StorageSearchMessagesData)
      if (currentRequest !== requestSeq) {
        return
      }
      searchResult.value = result.messages
      hasMore.value = result.hasMore
      currentOffset = result.messages.length
    }
    finally {
      if (currentRequest === requestSeq) {
        isLoading.value = false
      }
    }
  })

  async function loadMore() {
    const currentKeyword = keywordDebounced.value.trim()
    if (!currentKeyword || isLoadingMore.value || isLoading.value || !hasMore.value) {
      return
    }

    const currentRequest = ++requestSeq
    isLoadingMore.value = true

    bridge.sendEvent(CoreEventType.StorageSearchMessages, {
      chatId: options.chatId,
      content: currentKeyword,
      useVector,
      pagination: {
        limit,
        offset: currentOffset,
      },
    })

    try {
      const result = await bridge.waitForEvent(CoreEventType.StorageSearchMessagesData)
      if (currentRequest !== requestSeq) {
        return
      }
      searchResult.value = [...searchResult.value, ...result.messages]
      hasMore.value = result.hasMore
      currentOffset += result.messages.length
    }
    finally {
      if (currentRequest === requestSeq) {
        isLoadingMore.value = false
      }
    }
  }

  return {
    keyword,
    keywordDebounced,
    isLoading,
    isLoadingMore,
    hasMore,
    searchResult,
    loadMore,
  }
}
