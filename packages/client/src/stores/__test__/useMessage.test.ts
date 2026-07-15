import type { CorePagination } from '@tg-search/common'
import type { CoreMessage } from '@tg-search/core'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMessageStore } from '../useMessage'

// Mock dependencies
const sendEventMock = vi.fn()
const waitForEventMock = vi.fn()
const listRemoteMessagesMock = vi.fn()
const getLocalMessageContextMock = vi.fn()
vi.mock('../../composables/useBridge', () => ({
  useBridge: () => ({
    sendEvent: sendEventMock,
    waitForEvent: waitForEventMock,
    application: {
      listRemoteMessages: listRemoteMessagesMock,
      getLocalMessageContext: getLocalMessageContextMock,
    },
  }),
}))

vi.mock('../../utils/blob', () => ({
  createMediaBlob: vi.fn(media => media),
  cleanupMediaBlobs: vi.fn(),
}))

function createTestMessage(
  overrides: Partial<CoreMessage> & { platformMessageId: string, chatId: string, content: string, platformTimestamp: number },
): CoreMessage {
  // CoreMessage fields required (see core/src/types/message.ts)
  return {
    uuid: overrides.uuid ?? `${overrides.chatId}-${overrides.platformMessageId}`,
    platform: 'telegram',
    platformMessageId: overrides.platformMessageId,
    chatId: overrides.chatId,
    fromId: overrides.fromId ?? 'uid',
    fromName: overrides.fromName ?? 'User',
    content: overrides.content,
    media: overrides.media,
    reply: overrides.reply ?? { isReply: false },
    forward: overrides.forward ?? { isForward: false },
    platformTimestamp: overrides.platformTimestamp,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
    deletedAt: overrides.deletedAt,
    fromUserUuid: overrides.fromUserUuid,
  }
}

function toMessageRecord(message: CoreMessage) {
  return {
    id: message.platformMessageId,
    chatId: message.chatId,
    senderId: message.fromId,
    senderName: message.fromName,
    timestamp: message.platformTimestamp,
    text: message.content,
    forward: { isForward: false },
    media: [],
    links: [],
  }
}

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
      createTestMessage({ platformMessageId: '1', chatId: 'chat-1', content: 'msg 1', platformTimestamp: 1000 }),
      createTestMessage({ platformMessageId: '2', chatId: 'chat-1', content: 'msg 2', platformTimestamp: 2000 }),
    ]

    store.replaceMessages(messages, { chatId: 'chat-1' })

    expect(store.chatId.value).toBe('chat-1')
    expect(store.messageWindow).toBeDefined()
    expect(store.sortedMessageIds).toEqual(['1', '2'])
  })

  it('loads message context', async () => {
    const store = useMessageStore()
    const messages: CoreMessage[] = [
      createTestMessage({ platformMessageId: '10', chatId: 'chat-1', content: 'msg 10', platformTimestamp: 1000 }),
    ]

    getLocalMessageContextMock.mockResolvedValueOnce({
      ok: true,
      data: { messages: messages.map(toMessageRecord), targetIndex: 0 },
    })

    await store.loadMessageContext('chat-1', '10')

    expect(getLocalMessageContextMock).toHaveBeenCalledWith(expect.objectContaining({
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
      createTestMessage({ platformMessageId: '3', chatId: 'chat-1', content: 'msg 3', platformTimestamp: 3000 }),
    ]

    await store.pushMessages(newMessages)

    expect(store.sortedMessageIds).toContain('3')
  })

  it('fetches messages with pagination', async () => {
    const store = useMessageStore()
    const { fetchMessages, isLoading } = store.useFetchMessages('chat-1', 50)

    // Mock response promise but don't resolve immediately to check loading state
    let resolvePromise: (value: any) => void
    // eslint-disable-next-line style/max-statements-per-line
    const promise = new Promise((resolve) => { resolvePromise = resolve })
    listRemoteMessagesMock.mockReturnValue(promise)

    const pagination: CorePagination & { minId?: number } = { offset: 0, limit: 20 }
    const fetchPromise = fetchMessages(pagination, 'older')

    expect(isLoading.value).toBe(true)
    expect(listRemoteMessagesMock).toHaveBeenCalledWith({
      chatId: 'chat-1',
      limit: pagination.limit,
      cursor: '0',
    })

    // @ts-expect-error intentionally resolve for test
    resolvePromise({ ok: true, data: { items: [], nextCursor: null } })
    await fetchPromise

    expect(isLoading.value).toBe(false)
  })

  it('preserves the message anchor when fetching newer messages', async () => {
    const store = useMessageStore()
    const { fetchMessages } = store.useFetchMessages('chat-1', 50)
    listRemoteMessagesMock.mockResolvedValue({ ok: true, data: { items: [], nextCursor: null } })

    await fetchMessages({ offset: 0, limit: 20, minId: 42 }, 'newer')

    expect(listRemoteMessagesMock).toHaveBeenCalledWith({
      chatId: 'chat-1',
      limit: 20,
      cursor: undefined,
      minMessageId: 42,
    })
  })
})
