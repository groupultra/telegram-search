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
    firstState.chatTypeFilter.value = 'bot'
    firstState.searchScope.value = 'current'

    const secondState = useSearchDialogState(cacheKey, hasCurrentChatScope)

    expect(secondState.keyword.value).toBe('device code')
    expect(secondState.activeMode.value).toBe('messages')
    expect(secondState.chatTypeFilter.value).toBe('bot')
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

  it('defaults chat-scoped search to the current conversation when there is no cache', () => {
    const state = useSearchDialogState(ref('chat:42'), ref(true))

    expect(state.searchScope.value).toBe('current')
  })

  it('does not overwrite another cache entry when switching cache keys', () => {
    useSearchDialogState(ref('chat:2'), ref(true)).keyword.value = 'saved for chat 2'

    const cacheKey = ref('chat:1')
    const hasCurrentChatScope = ref(true)
    const state = useSearchDialogState(cacheKey, hasCurrentChatScope)
    state.keyword.value = 'saved for chat 1'

    cacheKey.value = 'chat:2'

    expect(state.keyword.value).toBe('saved for chat 2')

    const restoredChatTwoState = useSearchDialogState(ref('chat:2'), ref(true))
    expect(restoredChatTwoState.keyword.value).toBe('saved for chat 2')
  })
})
