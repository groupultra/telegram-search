import type { SearchMode } from '../../utils/search-dialog'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {
  resetSearchDialogResultsCache,
  useSearchDialogResults,
} from '../use-search-dialog-results'

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
    resetSearchDialogResultsCache()
  })

  it('restores cached search results for the same cache key', async () => {
    const searchMessagesPayload = {
      messages: [{
        uuid: 'message-1',
        chatId: '123',
        fromId: '456',
        fromName: 'Yukie',
        content: 'device code result',
        platformMessageId: '170319',
        platformTimestamp: Date.now(),
      }],
      hasMore: false,
    }
    const searchPhotosPayload = {
      photos: [],
      hasMore: false,
    }

    bridge.waitForEvent
      .mockResolvedValueOnce(searchMessagesPayload)
      .mockResolvedValueOnce(searchPhotosPayload)

    const keywordDebounced = ref('')
    const firstSearch = useSearchDialogResults({
      activeMode: ref<SearchMode>('messages'),
      cacheKey: ref('chat:123'),
      keywordDebounced,
      scopedChatId: ref('123'),
    })

    keywordDebounced.value = 'device code'
    await vi.waitFor(() => {
      expect(firstSearch.searchResult.value).toEqual(searchMessagesPayload.messages)
    })

    const restoredSearch = useSearchDialogResults({
      activeMode: ref<SearchMode>('messages'),
      cacheKey: ref('chat:123'),
      keywordDebounced: ref('device code'),
      scopedChatId: ref('123'),
    })

    expect(restoredSearch.searchResult.value).toEqual(searchMessagesPayload.messages)
    expect(restoredSearch.photoResult.value).toEqual(searchPhotosPayload.photos)
  })
})
