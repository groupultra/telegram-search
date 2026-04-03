import type { SearchMode } from '../../utils/search-dialog'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

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

  it('ignores stale responses after switching cache keys without changing scope', async () => {
    bridge.waitForEvent
      .mockResolvedValueOnce({
        messages: [{
          uuid: 'message-new',
          chatId: '2',
          fromId: '456',
          fromName: 'Yukie',
          content: 'new chat result',
          platformMessageId: '170320',
          platformTimestamp: Date.now(),
        }],
        hasMore: false,
      })
      .mockResolvedValueOnce({
        photos: [],
        hasMore: false,
      })

    const cachedKeyword = ref('')
    useSearchDialogResults({
      activeMode: ref<SearchMode>('messages'),
      cacheKey: ref('chat:2'),
      keywordDebounced: cachedKeyword,
      scopedChatId: ref(undefined),
    })

    cachedKeyword.value = 'device code'
    await nextTick()
    await vi.waitFor(() => {
      expect(bridge.sendEvent).toHaveBeenCalled()
    })

    let resolveMessages: ((value: { messages: { uuid: string, chatId: string, fromId: string, fromName: string, content: string, platformMessageId: string, platformTimestamp: number }[], hasMore: boolean }) => void) | undefined
    let resolvePhotos: ((value: { photos: never[], hasMore: boolean }) => void) | undefined

    bridge.waitForEvent
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveMessages = resolve
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolvePhotos = resolve
      }))

    const cacheKey = ref('chat:1')
    const keywordDebounced = ref('')
    const search = useSearchDialogResults({
      activeMode: ref<SearchMode>('messages'),
      cacheKey,
      keywordDebounced,
      scopedChatId: ref(undefined),
    })

    keywordDebounced.value = 'device code'
    await nextTick()

    expect(resolveMessages).toBeTypeOf('function')
    expect(resolvePhotos).toBeTypeOf('function')

    cacheKey.value = 'chat:2'
    await nextTick()
    expect(search.searchResult.value).toEqual([expect.objectContaining({
      uuid: 'message-new',
      chatId: '2',
    })])

    resolveMessages?.({
      messages: [{
        uuid: 'message-old',
        chatId: '1',
        fromId: '123',
        fromName: 'Old Chat',
        content: 'stale result',
        platformMessageId: '170319',
        platformTimestamp: Date.now(),
      }],
      hasMore: false,
    })
    resolvePhotos?.({
      photos: [],
      hasMore: false,
    })

    await Promise.resolve()
    await nextTick()

    expect(search.searchResult.value).toEqual([expect.objectContaining({
      uuid: 'message-new',
      chatId: '2',
    })])
  })
})
