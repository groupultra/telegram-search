import type { SearchMode } from '../../utils/search-dialog'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useSearchDialogResults } from '../use-search-dialog-results'

const bridge = {
  sendEvent: vi.fn(),
  waitForEvent: vi.fn(),
}

vi.mock('@tg-search/client', () => ({
  useBridge: () => bridge,
  waitForEventWithTimeout: async <T>(promise: Promise<T>) => promise,
}))

describe('useSearchDialogResults', () => {
  beforeEach(() => {
    bridge.sendEvent.mockReset()
    bridge.waitForEvent.mockReset()
  })

  it('runs a search immediately when a restored keyword is already present', async () => {
    bridge.waitForEvent
      .mockResolvedValueOnce({ messages: [], hasMore: false })
      .mockResolvedValueOnce({ photos: [], hasMore: false })

    useSearchDialogResults({
      activeMode: ref<SearchMode>('messages'),
      keyword: ref('device code'),
      keywordDebounced: ref('device code'),
      scopedChatId: ref('123'),
    })

    await vi.waitFor(() => {
      expect(bridge.sendEvent).toHaveBeenCalledWith('storage:search:messages', expect.objectContaining({
        chatId: '123',
        content: 'device code',
      }))
    })
  })

  it('does not search a new chat with a stale debounced keyword', async () => {
    bridge.waitForEvent
      .mockResolvedValueOnce({ messages: [], hasMore: false })
      .mockResolvedValueOnce({ photos: [], hasMore: false })

    const keyword = ref('new chat keyword')
    const keywordDebounced = ref('old chat keyword')

    useSearchDialogResults({
      activeMode: ref<SearchMode>('messages'),
      keyword,
      keywordDebounced,
      scopedChatId: ref('456'),
    })

    await Promise.resolve()

    expect(bridge.sendEvent).not.toHaveBeenCalled()

    keywordDebounced.value = keyword.value

    await vi.waitFor(() => {
      expect(bridge.sendEvent).toHaveBeenCalledWith('storage:search:messages', expect.objectContaining({
        chatId: '456',
        content: 'new chat keyword',
      }))
    })
  })
})
