import type { Ref } from 'vue'

import type { SearchDialogChatTypeFilter, SearchMode, SearchScope } from '../utils/search-dialog'

import { computed, ref, watch } from 'vue'

interface SearchDialogStateSnapshot {
  activeMode: SearchMode
  chatTypeFilter: SearchDialogChatTypeFilter
  keyword: string
  searchScope: SearchScope
}

const DEFAULT_STATE: SearchDialogStateSnapshot = {
  keyword: '',
  activeMode: 'all',
  chatTypeFilter: 'all',
  searchScope: 'all',
}

const searchDialogStateCache = new Map<string, SearchDialogStateSnapshot>()

function createStateSnapshot(cacheKey: string, hasCurrentChatScope: boolean): SearchDialogStateSnapshot {
  const cachedState = searchDialogStateCache.get(cacheKey)
  if (!cachedState) {
    return {
      ...DEFAULT_STATE,
      searchScope: hasCurrentChatScope ? 'current' : 'all',
    }
  }

  return {
    keyword: cachedState.keyword,
    activeMode: cachedState.activeMode,
    chatTypeFilter: cachedState.chatTypeFilter,
    searchScope: hasCurrentChatScope ? cachedState.searchScope : 'all',
  }
}

export function useSearchDialogState(cacheKey: Ref<string>, hasCurrentChatScope: Ref<boolean>) {
  const initialState = createStateSnapshot(cacheKey.value, hasCurrentChatScope.value)

  const keyword = ref(initialState.keyword)
  const activeMode = ref<SearchMode>(initialState.activeMode)
  const chatTypeFilter = ref<SearchDialogChatTypeFilter>(initialState.chatTypeFilter)
  const _searchScope = ref<SearchScope>(initialState.searchScope)

  // Guard: never allow 'current' scope when there is no current chat
  const searchScope = computed<SearchScope>({
    get: () => !hasCurrentChatScope.value && _searchScope.value === 'current' ? 'all' : _searchScope.value,
    set: (v) => { _searchScope.value = v },
  })

  watch(
    [cacheKey, hasCurrentChatScope],
    ([nextCacheKey, nextHasCurrentChatScope]) => {
      const nextState = createStateSnapshot(nextCacheKey, nextHasCurrentChatScope)
      keyword.value = nextState.keyword
      activeMode.value = nextState.activeMode
      chatTypeFilter.value = nextState.chatTypeFilter
      _searchScope.value = nextState.searchScope
    },
    { flush: 'sync' },
  )

  watch(
    [keyword, activeMode, chatTypeFilter, searchScope, hasCurrentChatScope],
    ([nextKeyword, nextActiveMode, nextChatTypeFilter, nextSearchScope, nextHasCurrentChatScope]) => {
      searchDialogStateCache.set(cacheKey.value, {
        keyword: nextKeyword,
        activeMode: nextActiveMode,
        chatTypeFilter: nextChatTypeFilter,
        searchScope: nextHasCurrentChatScope ? nextSearchScope : 'all',
      })
    },
    { immediate: true, flush: 'sync' },
  )

  return {
    activeMode,
    chatTypeFilter,
    keyword,
    searchScope,
  }
}

export function resetSearchDialogStateCache() {
  searchDialogStateCache.clear()
}
