import type { CoreDB } from '../../db'

import { describe, expect, it, vi } from 'vitest'

import { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import {
  findAccountIdsByJoinedChatId,
  findJoinedChatIdsByAccountId,
  linkAccountToJoinedChat,
} from '../account-joined-chats'

describe('account-joined-chats model', () => {
  it('linkAccountToJoinedChat should insert link with correct values', async () => {
    const returning = vi.fn(async () => [{ id: 'link-1' }])
    const onConflictDoNothing = vi.fn(() => ({
      returning,
    }))
    const values = vi.fn(() => ({
      onConflictDoNothing,
      returning,
    }))
    const insert = vi.fn(() => ({
      values,
      onConflictDoNothing,
      returning,
    }))

    const fakeDb: CoreDB = {
      insert,
    }

    await linkAccountToJoinedChat(fakeDb, 'account-1', 'joined-chat-1')

    expect(insert).toHaveBeenCalledWith(accountJoinedChatsTable)
    expect(values).toHaveBeenCalledWith({
      account_id: 'account-1',
      joined_chat_id: 'joined-chat-1',
    })
    expect(onConflictDoNothing).toHaveBeenCalled()
    expect(returning).toHaveBeenCalled()
  })

  it('findJoinedChatIdsByAccountId should return list of joined_chat_id', async () => {
    const rows = [
      { joined_chat_id: 'chat-1' },
      { joined_chat_id: 'chat-2' },
    ]

    const where = vi.fn(() => Promise.resolve(rows))
    const from = vi.fn(() => ({
      where,
    }))
    const select = vi.fn(() => ({
      from,
    }))

    const fakeDb: CoreDB = {
      select,
    }

    const result = await findJoinedChatIdsByAccountId(fakeDb, 'account-1')

    expect(select).toHaveBeenCalled()
    expect(from).toHaveBeenCalled()
    expect(where).toHaveBeenCalled()
    expect(result.unwrap()).toEqual(['chat-1', 'chat-2'])
  })

  it('findAccountIdsByJoinedChatId should return list of account_id', async () => {
    const rows = [
      { account_id: 'account-1' },
      { account_id: 'account-2' },
    ]

    const where = vi.fn(() => Promise.resolve(rows))
    const from = vi.fn(() => ({
      where,
    }))
    const select = vi.fn(() => ({
      from,
    }))

    const fakeDb: CoreDB = {
      select,
    }

    const result = await findAccountIdsByJoinedChatId(fakeDb, 'joined-chat-1')

    expect(select).toHaveBeenCalled()
    expect(from).toHaveBeenCalled()
    expect(where).toHaveBeenCalled()
    expect(result.unwrap()).toEqual(['account-1', 'account-2'])
  })
})
