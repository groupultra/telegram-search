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

/**
 * Create a deferred promise that can be resolved later from the test body.
 */
function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

/**
 * Create a minimal retrieval message payload for pagination tests.
 */
function createMessage(id: string) {
  return {
    uuid: id,
    platform: 'telegram' as const,
    platformMessageId: id,
    chatId: '123',
    fromId: 'u1',
    fromName: 'Tester',
    content: `message-${id}`,
    reply: {
      isReply: false,
      replyToId: undefined,
      replyToName: undefined,
    },
    forward: {
      isForward: false,
    },
    createdAt: 1,
    updatedAt: 1,
    deletedAt: undefined,
    platformTimestamp: 1,
  }
}

/**
 * Create a minimal retrieval photo payload for pagination tests.
 */
function createPhoto(id: string) {
  return {
    id,
    messageId: id,
    platformMessageId: id,
    chatId: '123',
    description: `photo-${id}`,
    mimeType: 'image/png',
    createdAt: 1,
  }
}

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

  it('clears stale message load-more state when a new top-level search starts', async () => {
    bridge.waitForEvent
      .mockResolvedValueOnce({ messages: [createMessage('initial')], hasMore: true })
      .mockResolvedValueOnce({ photos: [], hasMore: false })

    const keyword = ref('device code')
    const keywordDebounced = ref('device code')
    const results = useSearchDialogResults({
      activeMode: ref<SearchMode>('messages'),
      keyword,
      keywordDebounced,
      scopedChatId: ref('123'),
    })

    await vi.waitFor(() => {
      expect(results.searchResult.value).toHaveLength(1)
      expect(results.messagesHasMore.value).toBe(true)
    })

    const staleLoadMore = createDeferred<{ messages: ReturnType<typeof createMessage>[], hasMore: boolean }>()
    bridge.waitForEvent.mockImplementationOnce(() => staleLoadMore.promise)

    void results.loadMoreMessages()

    await vi.waitFor(() => {
      expect(results.isLoadingMoreMessages.value).toBe(true)
    })

    bridge.waitForEvent
      .mockResolvedValueOnce({ messages: [createMessage('fresh')], hasMore: false })
      .mockResolvedValueOnce({ photos: [], hasMore: false })

    keyword.value = 'fresh keyword'
    keywordDebounced.value = 'fresh keyword'

    await vi.waitFor(() => {
      expect(results.isLoadingMoreMessages.value).toBe(false)
      expect(results.searchResult.value.map(item => item.uuid)).toEqual(['fresh'])
    })

    staleLoadMore.resolve({
      messages: [createMessage('stale')],
      hasMore: false,
    })

    await Promise.resolve()

    expect(results.searchResult.value.map(item => item.uuid)).toEqual(['fresh'])
  })

  it('allows message and photo load-more requests to finish independently', async () => {
    bridge.waitForEvent
      .mockResolvedValueOnce({ messages: [createMessage('m1')], hasMore: true })
      .mockResolvedValueOnce({ photos: [createPhoto('p1')], hasMore: true })

    const results = useSearchDialogResults({
      activeMode: ref<SearchMode>('all'),
      keyword: ref('device code'),
      keywordDebounced: ref('device code'),
      scopedChatId: ref('123'),
    })

    await vi.waitFor(() => {
      expect(results.searchResult.value).toHaveLength(1)
      expect(results.photoResult.value).toHaveLength(1)
      expect(results.messagesHasMore.value).toBe(true)
      expect(results.photosHasMore.value).toBe(true)
    })

    const deferredMessages = createDeferred<{ messages: ReturnType<typeof createMessage>[], hasMore: boolean }>()
    const deferredPhotos = createDeferred<{ photos: ReturnType<typeof createPhoto>[], hasMore: boolean }>()

    bridge.waitForEvent
      .mockImplementationOnce(() => deferredMessages.promise)
      .mockImplementationOnce(() => deferredPhotos.promise)

    void results.loadMoreMessages()
    void results.loadMorePhotos()

    await vi.waitFor(() => {
      expect(results.isLoadingMoreMessages.value).toBe(true)
      expect(results.isLoadingMorePhotos.value).toBe(true)
    })

    deferredMessages.resolve({
      messages: [createMessage('m2')],
      hasMore: false,
    })

    await vi.waitFor(() => {
      expect(results.searchResult.value.map(item => item.uuid)).toEqual(['m1', 'm2'])
      expect(results.isLoadingMoreMessages.value).toBe(false)
    })

    deferredPhotos.resolve({
      photos: [createPhoto('p2')],
      hasMore: false,
    })

    await vi.waitFor(() => {
      expect(results.photoResult.value.map(item => item.id)).toEqual(['p1', 'p2'])
      expect(results.isLoadingMorePhotos.value).toBe(false)
    })
  })
})
