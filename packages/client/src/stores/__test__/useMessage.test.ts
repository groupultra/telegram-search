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

  it('fetches the latest messages while the window is empty', async () => {
    const store = useMessageStore()
    const { fetchMessages, isLoading } = store.useFetchMessages('chat-1', 50)

    // Mock response promise but don't resolve immediately to check loading state
    let resolvePromise: (value: any) => void
    // eslint-disable-next-line style/max-statements-per-line
    const promise = new Promise((resolve) => { resolvePromise = resolve })
    listRemoteMessagesMock.mockReturnValue(promise)

    const fetchPromise = fetchMessages(20, 'older')

    expect(isLoading.value).toBe(true)
    expect(listRemoteMessagesMock).toHaveBeenCalledWith({
      chatId: 'chat-1',
      limit: 20,
      cursor: undefined,
      minMessageId: undefined,
    })

    // @ts-expect-error intentionally resolve for test
    resolvePromise({ ok: true, data: { items: [], nextCursor: null } })
    await fetchPromise

    expect(isLoading.value).toBe(false)
  })

  it('anchors older and newer fetches on the loaded message IDs', async () => {
    // Regression: older pages used a running offset, which drifted whenever
    // new messages arrived and skipped or repeated history.
    const store = useMessageStore()
    const { fetchMessages } = store.useFetchMessages('chat-1', 50)
    store.replaceMessages([
      createTestMessage({ platformMessageId: '40', chatId: 'chat-1', content: 'msg 40', platformTimestamp: 1000 }),
      createTestMessage({ platformMessageId: '42', chatId: 'chat-1', content: 'msg 42', platformTimestamp: 2000 }),
    ], { chatId: 'chat-1' })
    listRemoteMessagesMock.mockResolvedValue({ ok: true, data: { items: [], nextCursor: null } })

    await fetchMessages(20, 'older')
    await fetchMessages(20, 'newer')

    expect(listRemoteMessagesMock).toHaveBeenNthCalledWith(1, {
      chatId: 'chat-1',
      limit: 20,
      cursor: '40',
      minMessageId: undefined,
    })
    expect(listRemoteMessagesMock).toHaveBeenNthCalledWith(2, {
      chatId: 'chat-1',
      limit: 20,
      cursor: undefined,
      minMessageId: 42,
    })
  })
})
