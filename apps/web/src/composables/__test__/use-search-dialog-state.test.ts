import { beforeEach, describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'

import { resetSearchDialogStateCache, useSearchDialogState } from '../use-search-dialog-state'

describe('useSearchDialogState', () => {
  beforeEach(() => {
    resetSearchDialogStateCache()
  })

  it('restores the previous keyword and filters for the same cache key', () => {
    const cacheKey = ref('chat:1')
    const hasCurrentChatScope = ref(true)

    const firstState = useSearchDialogState(cacheKey, hasCurrentChatScope)
    firstState.keyword.value = 'device code'
    firstState.activeMode.value = 'messages'
    firstState.searchScope.value = 'current'

    const secondState = useSearchDialogState(cacheKey, hasCurrentChatScope)

    expect(secondState.keyword.value).toBe('device code')
    expect(secondState.activeMode.value).toBe('messages')
    expect(secondState.searchScope.value).toBe('current')
  })

  it('falls back to all-scope when there is no current chat available', () => {
    const cacheKey = ref('global')
    const hasCurrentChatScope = ref(false)

    const state = useSearchDialogState(cacheKey, hasCurrentChatScope)
    state.searchScope.value = 'current'

    expect(state.searchScope.value).toBe('all')

    const restoredState = useSearchDialogState(computed(() => 'global'), ref(false))
    expect(restoredState.searchScope.value).toBe('all')
  })
})
