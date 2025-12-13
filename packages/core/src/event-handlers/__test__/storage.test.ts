import type { CoreDialog } from '../../types/dialog'

import { Ok } from '@unbird/result'
import { describe, expect, it, vi } from 'vitest'

import { createCoreContext } from '../../context'
import {
  fetchChatsByAccountId,
  fetchMessagesWithPhotos,
  getChatMessagesStats,
  isChatAccessibleByAccount,
  recordChats,
  retrieveMessages,
} from '../../models'
import { registerStorageEventHandlers } from '../storage'

vi.mock('../../models', () => {
  // Dialog-related mocks
  const fetchChatsByAccountId = vi.fn(async (_db: unknown, _accountId: string) => {
    const rows = [
      {
        id: 'joined-chat-1',
        platform: 'telegram',
        chat_id: '1001',
        chat_name: 'Test Chat',
        chat_type: 'user',
        dialog_date: Date.now(),
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]
    return Ok(rows)
  })

  const getChatMessagesStats = vi.fn(async (_db: unknown, _accountId: string) => {
    const stats = [
      {
        chat_id: '1001',
        message_count: 42,
      },
    ]
    return Ok(stats)
  })

  const recordChats = vi.fn(async (_db: unknown, _dialogs: CoreDialog[], _accountId?: string) => {
    // Simulate Result-like object used by production code
    return {
      expect<T>(_message: string): T[] {
        // For this test we don't need to assert on returned value
        return [] as unknown as T[]
      },
    }
  })

  // Message-related mocks
  const isChatAccessibleByAccount = vi.fn(async (_db: unknown, _accountId: string, _chatId: string) => Ok(true))
  const fetchMessageContextWithPhotos = vi.fn()
  const fetchMessagesWithPhotos = vi.fn(async (_db: unknown, _accountId: string, _chatId: string, _pagination: unknown) => Ok([] as unknown[]))
  const recordMessagesWithMedia = vi.fn()
  const retrieveMessages = vi.fn(async (_db: unknown, _accountId: string, _chatId: string | undefined, _dimension: unknown, _content: unknown, _pagination: unknown, _filters: unknown) => Ok([] as unknown[]))

  return {
    fetchChatsByAccountId,
    getChatMessagesStats,
    recordChats,

    isChatAccessibleByAccount,
    fetchMessageContextWithPhotos,
    fetchMessagesWithPhotos,
    recordMessagesWithMedia,
    retrieveMessages,

    // Unused here but required by storage.ts
    convertToCoreRetrievalMessages: vi.fn(),
  }
})

describe('storage event handlers - dialogs with accounts', () => {
  it('storage:fetch:dialogs should query dialogs for given account and emit mapped dialogs', async () => {
    const ctx = createCoreContext()
    registerStorageEventHandlers(ctx)

    const ACCOUNT_ID = 'account-xyz'

    const dialogsPromise = new Promise<CoreDialog[]>((resolve) => {
      ctx.emitter.on('storage:dialogs', ({ dialogs }) => {
        resolve(dialogs)
      })
    })

    ctx.emitter.emit('storage:fetch:dialogs', { accountId: ACCOUNT_ID })

    const dialogs = await dialogsPromise

    // Verify models were called with correct account id (first arg is db instance)
    expect(fetchChatsByAccountId).toHaveBeenCalledWith(expect.anything(), ACCOUNT_ID)
    expect(getChatMessagesStats).toHaveBeenCalledWith(expect.anything(), ACCOUNT_ID)

    // Verify mapping to CoreDialog shape
    expect(dialogs).toEqual([
      {
        id: 1001,
        name: 'Test Chat',
        type: 'user',
        messageCount: 42,
      },
    ])
  })

  it('storage:record:dialogs should call recordChats with dialogs and accountId', async () => {
    const ctx = createCoreContext()
    registerStorageEventHandlers(ctx)

    const ACCOUNT_ID = 'account-abc'
    const dialogs: CoreDialog[] = [
      {
        id: 2001,
        name: 'Another Chat',
        type: 'group',
        messageCount: 0,
      },
    ]

    ctx.emitter.emit('storage:record:dialogs', { dialogs, accountId: ACCOUNT_ID })

    expect(recordChats).toHaveBeenCalledTimes(1)
    expect(recordChats).toHaveBeenCalledWith(expect.anything(), dialogs, ACCOUNT_ID)
  })
})

describe('storage event handlers - message access control', () => {
  it('storage:fetch:messages should reject when account has no access to chat', async () => {
    const ctx = createCoreContext()
    registerStorageEventHandlers(ctx)

    const ACCOUNT_ID = 'account-no-access'
    const CHAT_ID = '1001'

    ctx.setCurrentAccountId(ACCOUNT_ID)

    // For this test, deny access
    ;(isChatAccessibleByAccount as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(Ok(false))

    const errorPromise = new Promise<string>((resolve) => {
      ctx.emitter.on('core:error', ({ error }) => {
        resolve(error)
      })
    })

    ctx.emitter.emit('storage:fetch:messages', {
      chatId: CHAT_ID,
      pagination: { limit: 20, offset: 0 },
    })

    const error = await errorPromise

    expect(error).toBe('Unauthorized chat access')
    expect(isChatAccessibleByAccount).toHaveBeenCalledWith(expect.anything(), ACCOUNT_ID, CHAT_ID)
    expect(fetchMessagesWithPhotos).not.toHaveBeenCalled()
  })

  it('storage:search:messages should reject when account has no access to specified chatId', async () => {
    const ctx = createCoreContext()
    registerStorageEventHandlers(ctx)

    const ACCOUNT_ID = 'account-no-access'
    const CHAT_ID = '2002'

    ctx.setCurrentAccountId(ACCOUNT_ID)

    // For this test, deny access for this chat
    ;(isChatAccessibleByAccount as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(Ok(false))

    const errorPromise = new Promise<string>((resolve) => {
      ctx.emitter.on('core:error', ({ error }) => {
        resolve(error)
      })
    })

    ctx.emitter.emit('storage:search:messages', {
      chatId: CHAT_ID,
      content: 'test search',
      useVector: false,
      pagination: { limit: 20, offset: 0 },
    })

    const error = await errorPromise

    expect(error).toBe('Unauthorized chat access')
    expect(isChatAccessibleByAccount).toHaveBeenCalledWith(expect.anything(), ACCOUNT_ID, CHAT_ID)
    expect(retrieveMessages).not.toHaveBeenCalled()
  })
})
