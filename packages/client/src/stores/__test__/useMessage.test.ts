import type { CoreMessage, CorePagination } from '@tg-search/core'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMessageStore } from '../useMessage'

// Mock dependencies
const sendEventMock = vi.fn()
const waitForEventMock = vi.fn()
vi.mock('../../composables/useBridge', () => ({
  useBridge: () => ({
    sendEvent: sendEventMock,
    waitForEvent: waitForEventMock,
  }),
}))

vi.mock('../../utils/blob', () => ({
  createMediaBlob: vi.fn(media => media),
  cleanupMediaBlobs: vi.fn(),
}))

describe('useMessageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('resets correctly', () => {
    const store = useMessageStore()
    store.replaceMessages([], { chatId: 'chat-1' })
    expect(store.chatId.value).toBe('chat-1')

    store.reset()
    expect(store.chatId.value).toBeUndefined()
    expect(store.messageWindow).toBeUndefined()
  })

  it('replaces messages and initializes window', () => {
    const store = useMessageStore()
    const messages: CoreMessage[] = [
      { platformMessageId: '1', chatId: 'chat-1', content: 'msg 1', date: 1000 },
      { platformMessageId: '2', chatId: 'chat-1', content: 'msg 2', date: 2000 },
    ]

    store.replaceMessages(messages, { chatId: 'chat-1' })

    expect(store.chatId.value).toBe('chat-1')
    expect(store.messageWindow).toBeDefined()
    expect(store.sortedMessageIds).toEqual(['1', '2'])
  })

  it('loads message context', async () => {
    const store = useMessageStore()
    const messages: CoreMessage[] = [
      { platformMessageId: '10', chatId: 'chat-1', content: 'msg 10', date: 1000 },
    ]

    waitForEventMock.mockResolvedValueOnce({ messages })

    await store.loadMessageContext('chat-1', '10')

    expect(sendEventMock).toHaveBeenCalledWith('storage:fetch:message-context', expect.objectContaining({
      chatId: 'chat-1',
      messageId: '10',
    }))
    expect(store.chatId.value).toBe('chat-1')
    expect(store.sortedMessageIds).toEqual(['10'])
  })

  it('pushes messages', async () => {
    const store = useMessageStore()
    // Initialize first
    store.replaceMessages([], { chatId: 'chat-1' })

    const newMessages: CoreMessage[] = [
      { platformMessageId: '3', chatId: 'chat-1', content: 'msg 3', date: 3000 },
    ]

    await store.pushMessages(newMessages)

    expect(store.sortedMessageIds).toContain('3')
  })

  it('fetches messages with pagination', async () => {
    const store = useMessageStore()
    const { fetchMessages, isLoading } = store.useFetchMessages('chat-1', 50)

    // Mock response promise but don't resolve immediately to check loading state
    let resolvePromise: (value: any) => void
    const promise = new Promise(resolve => { resolvePromise = resolve })
    waitForEventMock.mockReturnValue(promise)

    const pagination: CorePagination & { minId?: number } = { offset: 0, limit: 20 }
    fetchMessages(pagination, 'older')

    expect(isLoading.value).toBe(true)
    expect(sendEventMock).toHaveBeenCalledWith('message:fetch', {
      chatId: 'chat-1',
      pagination,
    })

    // @ts-ignore
    resolvePromise({ messages: [] })
    // Wait for promise chain
    await new Promise(process.nextTick)

    expect(isLoading.value).toBe(false)
  })
})
