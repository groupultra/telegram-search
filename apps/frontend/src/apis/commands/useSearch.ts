import type { SearchRequest } from '@tg-search/server'

import { computed, ref } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

/**
 * Search composable for managing search state and functionality
 */
export function useSearch() {
  // Search parameters
  const query = ref('')
  const currentPage = ref(1)
  const pageSize = ref(20)
  const currentChatId = ref<number | undefined>()
  const currentFolderId = ref<number | undefined>()
  const useVectorSearch = ref(false)

  // Initialize command handler
  const {
    commands,
    currentCommand,
    progress,
    error,
    isLoading,
    isStreaming,
    executeCommand,
    cleanup,
  } = useCommandHandler<SearchRequest>({
    endpoint: '/search',
    errorMessage: '搜索失败',
  })

  // Computed results from current command
  const results = computed(() => {
    if (!currentCommand.value?.metadata?.results)
      return []
    return currentCommand.value.metadata.results
  })

  const total = computed(() => {
    return currentCommand.value?.metadata?.total || 0
  })

  /**
   * Execute search with current parameters
   */
  async function search(params?: Partial<SearchRequest>) {
    if (!query.value.trim() && !params?.query) {
      return { success: false, error: new Error('搜索词不能为空') }
    }

    // Update search scope if provided
    if (params?.chatId !== undefined)
      currentChatId.value = params.chatId
    if (params?.folderId !== undefined)
      currentFolderId.value = params.folderId

    const searchParams: SearchRequest = {
      query: params?.query || query.value,
      offset: params?.offset || (currentPage.value - 1) * pageSize.value,
      limit: params?.limit || pageSize.value,
      folderId: currentFolderId.value,
      chatId: currentChatId.value,
      useVectorSearch: useVectorSearch.value,
    }

    return executeCommand(searchParams)
  }

  /**
   * Handle page change
   */
  function changePage(page: number) {
    currentPage.value = page
    return search()
  }

  /**
   * Reset search state
   */
  function reset() {
    query.value = ''
    currentPage.value = 1
    currentChatId.value = undefined
    currentFolderId.value = undefined
    useVectorSearch.value = false
    cleanup()
  }

  return {
    // State
    query,
    isLoading,
    isStreaming,
    results,
    total,
    error,
    currentPage,
    pageSize,
    progress,
    currentChatId,
    currentFolderId,
    useVectorSearch,
    commands,
    currentCommand,

    // Methods
    search,
    changePage,
    reset,
  }
}
