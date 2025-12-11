import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import { accountsTable } from '../../schemas/accounts'
import { joinedChatsTable } from '../../schemas/joined-chats'
import {
  findAccountIdsByJoinedChatId,
  findJoinedChatIdsByAccountId,
  linkAccountToJoinedChat,
} from '../account-joined-chats'

async function setupDb() {
  return mockDB({
    accountsTable,
    joinedChatsTable,
    accountJoinedChatsTable,
  })
}

describe('models/account-joined-chats', () => {
  it('linkAccountToJoinedChat inserts a link and returns it', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-1',
      chat_name: 'Test Chat',
      chat_type: 'user',
    }).returning()

    const result = await linkAccountToJoinedChat(db, account.id, chat.id)
    const rows = result

    expect(rows).toBeDefined()
    expect(rows.account_id).toBe(account.id)
    expect(rows.joined_chat_id).toBe(chat.id)

    const linksInDb = await db.select().from(accountJoinedChatsTable)
    expect(linksInDb).toHaveLength(1)
  })

  it('linkAccountToJoinedChat is idempotent due to ON CONFLICT DO NOTHING', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-1',
      chat_name: 'Test Chat',
      chat_type: 'user',
    }).returning()

    await linkAccountToJoinedChat(db, account.id, chat.id)
    await linkAccountToJoinedChat(db, account.id, chat.id)

    const linksInDb = await db.select().from(accountJoinedChatsTable)
    expect(linksInDb).toHaveLength(1)
  })

  it('findJoinedChatIdsByAccountId returns all joined_chat_ids for an account', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [chat1] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-1',
      chat_name: 'Test Chat 1',
      chat_type: 'user',
    }).returning()

    const [chat2] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-2',
      chat_name: 'Test Chat 2',
      chat_type: 'group',
    }).returning()

    await linkAccountToJoinedChat(db, account.id, chat1.id)
    await linkAccountToJoinedChat(db, account.id, chat2.id)

    const result = await findJoinedChatIdsByAccountId(db, account.id)
    const joinedChatIds = result.unwrap()

    expect(new Set(joinedChatIds)).toEqual(new Set([chat1.id, chat2.id]))
  })

  it('findAccountIdsByJoinedChatId returns all account_ids for a joined chat', async () => {
    const db = await setupDb()

    const [account1] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [account2] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-2',
    }).returning()

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-1',
      chat_name: 'Test Chat',
      chat_type: 'group',
    }).returning()

    await linkAccountToJoinedChat(db, account1.id, chat.id)
    await linkAccountToJoinedChat(db, account2.id, chat.id)

    const result = await findAccountIdsByJoinedChatId(db, chat.id)
    const accountIds = result.unwrap()

    expect(new Set(accountIds)).toEqual(new Set([account1.id, account2.id]))
  })
})
