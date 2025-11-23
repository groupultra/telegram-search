import type { CoreDialog } from '../../types/dialog'

import { describe, expect, it, vi } from 'vitest'

import { setDbInstanceForTests } from '../../db'
import { accountJoinedChatsTable } from '../../schemas/account_joined_chats'
import { joinedChatsTable } from '../../schemas/joined_chats'
import { fetchChatsByAccountId, recordChats } from '../chats'

describe('chats model with accounts', () => {
  it('fetchChatsByAccountId should join account_joined_chats and joined_chats and return rows', async () => {
    const rows = [
      {
        id: 'joined-chat-1',
        platform: 'telegram',
        chat_id: '1001',
        chat_name: 'Test Chat',
        chat_type: 'user',
        dialog_date: 123,
        created_at: 1,
        updated_at: 2,
      },
    ]

    const orderBy = vi.fn(() => rows)
    const where = vi.fn(() => ({
      orderBy,
    }))
    const innerJoin = vi.fn(() => ({
      where,
    }))
    const from = vi.fn(() => ({
      innerJoin,
    }))
    const select = vi.fn(() => ({
      from,
    }))

    const fakeDb = {
      select,
    }

    setDbInstanceForTests(fakeDb)

    const result = await fetchChatsByAccountId('account-1')

    expect(select).toHaveBeenCalledWith({
      id: joinedChatsTable.id,
      platform: joinedChatsTable.platform,
      chat_id: joinedChatsTable.chat_id,
      chat_name: joinedChatsTable.chat_name,
      chat_type: joinedChatsTable.chat_type,
      dialog_date: joinedChatsTable.dialog_date,
      created_at: joinedChatsTable.created_at,
      updated_at: joinedChatsTable.updated_at,
    })
    expect(from).toHaveBeenCalledWith(joinedChatsTable)
    expect(innerJoin).toHaveBeenCalledWith(
      accountJoinedChatsTable,
      expect.anything(),
    )
    expect(where).toHaveBeenCalled()
    expect(orderBy).toHaveBeenCalled()
    expect(result.unwrap()).toEqual(rows)
  })

  it('recordChats should insert chats and link them to account', async () => {
    const dialogs: CoreDialog[] = [
      {
        id: 1001,
        name: 'Chat 1',
        type: 'user',
        messageCount: 0,
      },
    ]

    const insertedRows = [
      { id: 'joined-chat-1' },
    ]

    const onConflictDoNothingLinks = vi.fn(() => undefined)
    const linkValues = vi.fn(() => ({
      onConflictDoNothing: onConflictDoNothingLinks,
    }))

    const returning = vi.fn(async () => insertedRows)
    const onConflictDoUpdate = vi.fn(() => ({
      returning,
    }))
    const chatsValues = vi.fn(() => ({
      onConflictDoUpdate,
      returning,
    }))

    const chatsInsert = vi.fn((table: unknown) => {
      if (table === joinedChatsTable) {
        return {
          values: chatsValues,
          onConflictDoUpdate,
          returning,
        }
      }
      if (table === accountJoinedChatsTable) {
        return {
          values: linkValues,
          onConflictDoNothing: onConflictDoNothingLinks,
        }
      }
      throw new Error('Unexpected table')
    })

    const transaction = vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      // Simulate drizzle transaction: pass tx with insert method
      return fn({ insert: chatsInsert })
    })

    const fakeDb = {
      transaction,
    }

    setDbInstanceForTests(fakeDb)

    const result = await recordChats(dialogs, 'account-1')

    expect(transaction).toHaveBeenCalledTimes(1)

    // First insert into joined_chats
    expect(chatsInsert).toHaveBeenCalledWith(joinedChatsTable)
    expect(chatsValues).toHaveBeenCalledWith([
      {
        platform: 'telegram',
        chat_id: '1001',
        chat_name: 'Chat 1',
        chat_type: 'user',
        dialog_date: expect.any(Number),
      },
    ])
    expect(onConflictDoUpdate).toHaveBeenCalled()
    expect(returning).toHaveBeenCalled()

    // Then insert into account_joined_chats
    expect(chatsInsert).toHaveBeenCalledWith(accountJoinedChatsTable)
    expect(linkValues).toHaveBeenCalledWith([
      {
        account_id: 'account-1',
        joined_chat_id: 'joined-chat-1',
      },
    ])
    expect(onConflictDoNothingLinks).toHaveBeenCalled()

    expect(result.unwrap()).toEqual(insertedRows)
  })

  it('recordChats should not link chats when accountId is falsy', async () => {
    const dialogs: CoreDialog[] = [
      {
        id: 1002,
        name: 'Chat 2',
        type: 'user',
        messageCount: 0,
      },
    ]

    const insertedRows = [
      { id: 'joined-chat-2' },
    ]

    const onConflictDoNothingLinks = vi.fn(() => undefined)
    const linkValues = vi.fn(() => ({
      onConflictDoNothing: onConflictDoNothingLinks,
    }))

    const returning = vi.fn(async () => insertedRows)
    const onConflictDoUpdate = vi.fn(() => ({
      returning,
    }))
    const chatsValues = vi.fn(() => ({
      onConflictDoUpdate,
      returning,
    }))

    const chatsInsert = vi.fn((table: unknown) => {
      if (table === joinedChatsTable) {
        return {
          values: chatsValues,
          onConflictDoUpdate,
          returning,
        }
      }
      if (table === accountJoinedChatsTable) {
        return {
          values: linkValues,
          onConflictDoNothing: onConflictDoNothingLinks,
        }
      }
      throw new Error('Unexpected table')
    })

    const transaction = vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      return fn({ insert: chatsInsert })
    })

    const fakeDb = {
      transaction,
    }

    setDbInstanceForTests(fakeDb)

    const result = await recordChats(dialogs, '') // falsy accountId

    expect(transaction).toHaveBeenCalledTimes(1)

    // joined_chats still inserted
    expect(chatsInsert).toHaveBeenCalledWith(joinedChatsTable)
    expect(chatsValues).toHaveBeenCalled()

    // account_joined_chats should NOT be inserted
    expect(chatsInsert).not.toHaveBeenCalledWith(accountJoinedChatsTable)
    expect(onConflictDoNothingLinks).not.toHaveBeenCalled()

    expect(result.unwrap()).toEqual(insertedRows)
  })
})
