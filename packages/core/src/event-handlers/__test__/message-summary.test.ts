import type { Models } from '../../models'
import type { MessageService } from '../../services/message'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { defineInvoke } from '@moeru/eventa'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../../mock'
import { createCoreContext } from '../../context'
import { messageFetchSummaryInvoke } from '../../events'
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

describe('messageFetchSummaryInvoke', () => {
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

    const invoke = defineInvoke(ctx.ctx, messageFetchSummaryInvoke)
    const result = await invoke({ chatId: '1', limit: 1000, mode: 'unread' })

    expect(result.mode).toBe('unread')
    expect(result.messages.length).toBe(2)
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

    const invoke = defineInvoke(ctx.ctx, messageFetchSummaryInvoke)
    const result = await invoke({ chatId: '1', limit: 1000, mode: 'today' })

    expect(result.mode).toBe('today')
    expect(result.messages.length).toBe(2)
    expect(mockMessageService.fetchRecentMessagesByTimeRange).toHaveBeenCalledOnce()
    expect(mockMessageService.fetchUnreadMessages).not.toHaveBeenCalled()
  })
})
