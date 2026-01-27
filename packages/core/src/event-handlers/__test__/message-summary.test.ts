import type { Models } from '../../models'
import type { MessageService } from '../../services/message'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../../mock'
import { createCoreContext } from '../../context'
import { CoreEventType } from '../../types/events'
import { registerMessageEventHandlers } from '../message'

const models = {} as unknown as Models
const logger = useLogger()

function createApiMessage(id: number, date: number, content: string) {
  // NOTE: For event-handler tests we only need the fields used by convertToCoreMessage().
  // We use a structural mock instead of invoking GramJS constructors (their typing lags runtime).
  return {
    id,
    date,
    message: content,
    peerId: new Api.PeerUser({ userId: bigInt(1) }),
    sender: new Api.User({ id: bigInt(42), firstName: 'Alice' }),
    senderId: bigInt(42),
  } as unknown as Api.Message
}

describe(CoreEventType.MessageFetchSummary, () => {
  it('mode=unread should use fetchUnreadMessages', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    const mockMessageService: Pick<MessageService, 'fetchUnreadMessages' | 'fetchRecentMessagesByTimeRange' | 'fetchMessages' | 'markAsRead' | 'sendMessage' | 'fetchSpecificMessages'> = {
      async* fetchMessages() {},
      sendMessage: vi.fn(),
      fetchSpecificMessages: vi.fn(async () => []),
      markAsRead: vi.fn(async () => {}),
      fetchUnreadMessages: vi.fn(async () => {
        const now = Math.floor(Date.now() / 1000)
        return [
          createApiMessage(3, now - 10, 'u3'),
          createApiMessage(2, now - 20, 'u2'),
        ]
      }),
      fetchRecentMessagesByTimeRange: vi.fn(async () => []),
    }

    registerMessageEventHandlers(ctx, logger)(mockMessageService as unknown as MessageService)

    const received: Array<{ mode: 'unread' | 'today' | 'last24h', count: number }> = []
    ctx.emitter.on(CoreEventType.MessageSummaryData, ({ mode, messages }) => {
      received.push({ mode, count: messages.length })
    })

    ctx.emitter.emit(CoreEventType.MessageFetchSummary, { chatId: '1', limit: 1000, mode: 'unread' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(received).toHaveLength(1)
    expect(received[0].mode).toBe('unread')
    expect(received[0].count).toBe(2)
    expect(mockMessageService.fetchRecentMessagesByTimeRange).not.toHaveBeenCalled()
  })

  it('mode=today should use fetchRecentMessagesByTimeRange', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    const mockMessageService: Pick<MessageService, 'fetchUnreadMessages' | 'fetchRecentMessagesByTimeRange' | 'fetchMessages' | 'markAsRead' | 'sendMessage' | 'fetchSpecificMessages'> = {
      async* fetchMessages() {},
      sendMessage: vi.fn(),
      fetchSpecificMessages: vi.fn(async () => []),
      markAsRead: vi.fn(async () => {}),
      fetchUnreadMessages: vi.fn(async () => []),
      fetchRecentMessagesByTimeRange: vi.fn(async () => {
        const now = Math.floor(Date.now() / 1000)
        return [
          createApiMessage(9, now - 5, 'r9'),
          createApiMessage(8, now - 15, 'r8'),
        ]
      }),
    }

    registerMessageEventHandlers(ctx, logger)(mockMessageService as unknown as MessageService)

    const received: Array<{ mode: 'unread' | 'today' | 'last24h', count: number }> = []
    ctx.emitter.on(CoreEventType.MessageSummaryData, ({ mode, messages }) => {
      received.push({ mode, count: messages.length })
    })

    ctx.emitter.emit(CoreEventType.MessageFetchSummary, { chatId: '1', limit: 1000, mode: 'today' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(received).toHaveLength(1)
    expect(received[0].mode).toBe('today')
    expect(received[0].count).toBe(2)
    expect(mockMessageService.fetchRecentMessagesByTimeRange).toHaveBeenCalledOnce()
    expect(mockMessageService.fetchUnreadMessages).not.toHaveBeenCalled()
  })
})
