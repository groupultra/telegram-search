import type { Ref } from 'vue'

import type { SearchMode, SearchScope } from '../utils/search-dialog'

import { ref, watch } from 'vue'

interface SearchDialogStateSnapshot {
  activeMode: SearchMode
  keyword: string
  searchScope: SearchScope
}

const DEFAULT_STATE: SearchDialogStateSnapshot = {
  keyword: '',
  activeMode: 'all',
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
    searchScope: hasCurrentChatScope ? cachedState.searchScope : 'all',
  }
}

export function useSearchDialogState(cacheKey: Ref<string>, hasCurrentChatScope: Ref<boolean>) {
  const initialState = createStateSnapshot(cacheKey.value, hasCurrentChatScope.value)

  const keyword = ref(initialState.keyword)
  const activeMode = ref<SearchMode>(initialState.activeMode)
  const searchScope = ref<SearchScope>(initialState.searchScope)

  watch(
    [cacheKey, hasCurrentChatScope],
    ([nextCacheKey, nextHasCurrentChatScope]) => {
      const nextState = createStateSnapshot(nextCacheKey, nextHasCurrentChatScope)
      keyword.value = nextState.keyword
      activeMode.value = nextState.activeMode
      searchScope.value = nextState.searchScope
    },
    { flush: 'sync' },
  )

  watch(hasCurrentChatScope, (nextHasCurrentChatScope) => {
    if (!nextHasCurrentChatScope && searchScope.value === 'current') {
      searchScope.value = 'all'
    }
  }, { flush: 'sync' })

  watch(searchScope, (nextSearchScope) => {
    if (!hasCurrentChatScope.value && nextSearchScope === 'current') {
      searchScope.value = 'all'
    }
  }, { flush: 'sync' })

  watch(
    [keyword, activeMode, searchScope, hasCurrentChatScope],
    ([nextKeyword, nextActiveMode, nextSearchScope, nextHasCurrentChatScope]) => {
      searchDialogStateCache.set(cacheKey.value, {
        keyword: nextKeyword,
        activeMode: nextActiveMode,
        searchScope: nextHasCurrentChatScope ? nextSearchScope : 'all',
      })
    },
    { immediate: true, flush: 'sync' },
  )

  return {
    activeMode,
    keyword,
    searchScope,
  }
}

export function resetSearchDialogStateCache() {
  searchDialogStateCache.clear()
}
