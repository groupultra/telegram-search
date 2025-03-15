import type { SearchCompleteResponse, type SearchRequest } from '@tg-search/server'

import { computed, ref } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'
import { usePagination } from '../../composables/usePagination'

/**
 * Search composable for managing search state and functionality
 */
export function useSearch() {
  // Search parameters
  const query = ref('')
  const currentChatId = ref<number | undefined>()
  const currentFolderId = ref<number | undefined>()
  const useVectorSearch = ref(false)

  // Initialize pagination
  const {
    currentPage,
    pageSize,
    setPage,
  } = usePagination({
    defaultPage: 1,
    defaultPageSize: 20,
  })

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
    errorMessage: 'Search failed',
  })

  const data = computed<SearchCompleteResponse | undefined>(() => {
    return currentCommand.value?.metadata as SearchCompleteResponse | undefined
  })

  /**
   * Execute search with current parameters
   */
  async function search(params?: Partial<SearchRequest>) {
    if (!query.value.trim() && !params?.query) {
      return { success: false, error: new Error('Search query cannot be empty') }
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
    setPage(page)
    return search()
  }

  /**
   * Reset search state
   */
  function reset() {
    query.value = ''
    setPage(1)
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
    data,
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
