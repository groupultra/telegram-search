import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useMessageSearch } from '../useMessageSearch'

const bridge = {
  sendEvent: vi.fn(),
  waitForEvent: vi.fn(),
}

vi.mock('@tg-search/client', () => ({
  useBridge: () => bridge,
}))

describe('useMessageSearch', () => {
  beforeEach(() => {
    bridge.sendEvent.mockReset()
    bridge.waitForEvent.mockReset()
    bridge.waitForEvent.mockResolvedValue({ messages: [], hasMore: false })
  })

  it('sends consistent search payload for global search', async () => {
    const { keyword } = useMessageSearch({ debounceMs: 0 })

    keyword.value = 'hello'
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()

    expect(bridge.sendEvent).toHaveBeenCalledWith('storage:search:messages', {
      chatId: undefined,
      content: 'hello',
      useVector: true,
      pagination: { limit: 10, offset: 0 },
    })
  })

  it('sends consistent search payload for chat-scoped search', async () => {
    const { keyword } = useMessageSearch({ chatId: '123', debounceMs: 0 })

    keyword.value = 'hello'
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()

    expect(bridge.sendEvent).toHaveBeenCalledWith('storage:search:messages', {
      chatId: '123',
      content: 'hello',
      useVector: true,
      pagination: { limit: 10, offset: 0 },
    })
  })
})
