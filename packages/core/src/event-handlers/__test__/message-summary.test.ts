import type { Models } from '../../models'
import type { MessageService } from '../../services/message'

import bigInt from 'big-integer'
import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../../mock'
import { createCoreContext } from '../../context'
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

describe('message:fetch:summary', () => {
  it('should return unread messages when available', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    const mockMessageService: Pick<MessageService, 'fetchUnreadMessages' | 'fetchRecentMessagesByTimeRange' | 'fetchMessages' | 'markAsRead' | 'sendMessage' | 'fetchSpecificMessages'> = {
      fetchMessages: async function* () {},
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

    const received: Array<{ source: 'unread' | 'fallback', count: number }> = []
    ctx.emitter.on('message:summary-data', ({ source, messages }) => {
      received.push({ source, count: messages.length })
    })

    ctx.emitter.emit('message:fetch:summary', { chatId: '1', limit: 1000, fallbackWindow: 'last24h' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(received).toHaveLength(1)
    expect(received[0].source).toBe('unread')
    expect(received[0].count).toBe(2)
    expect(mockMessageService.fetchRecentMessagesByTimeRange).not.toHaveBeenCalled()
  })

  it('should fallback to time window when unread is empty', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    const mockMessageService: Pick<MessageService, 'fetchUnreadMessages' | 'fetchRecentMessagesByTimeRange' | 'fetchMessages' | 'markAsRead' | 'sendMessage' | 'fetchSpecificMessages'> = {
      fetchMessages: async function* () {},
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

    const received: Array<{ source: 'unread' | 'fallback', fallbackWindow?: 'today' | 'last24h', count: number }> = []
    ctx.emitter.on('message:summary-data', ({ source, fallbackWindow, messages }) => {
      received.push({ source, fallbackWindow, count: messages.length })
    })

    ctx.emitter.emit('message:fetch:summary', { chatId: '1', limit: 1000, fallbackWindow: 'today' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(received).toHaveLength(1)
    expect(received[0].source).toBe('fallback')
    expect(received[0].fallbackWindow).toBe('today')
    expect(received[0].count).toBe(2)
    expect(mockMessageService.fetchRecentMessagesByTimeRange).toHaveBeenCalledOnce()
  })
})

