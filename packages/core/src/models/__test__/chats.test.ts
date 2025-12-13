import type { CoreDialog } from '../../types/dialog'

import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import { accountsTable } from '../../schemas/accounts'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { chatModels } from '../chats'

async function setupDb() {
  return mockDB({
    accountsTable,
    joinedChatsTable,
    accountJoinedChatsTable,
  })
}

describe('models/chats', () => {
  it('recordChats inserts dialogs and links them to account', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const dialogs: CoreDialog[] = [
      {
        id: 1,
        name: 'Chat 1',
        type: 'user',
        lastMessageDate: new Date('2024-01-01T00:00:00Z'),
      },
      {
        id: 2,
        name: 'Chat 2',
        type: 'group',
        lastMessageDate: new Date('2024-01-02T00:00:00Z'),
      },
    ]

    const result = await chatModels.recordChats(db, dialogs, account.id)
    const inserted = result

    expect(inserted).toHaveLength(2)

    const chatsInDb = await db.select().from(joinedChatsTable)
    expect(chatsInDb.map(c => c.chat_name).sort()).toEqual(['Chat 1', 'Chat 2'])

    const links = await db.select().from(accountJoinedChatsTable)
    expect(links).toHaveLength(2)
    expect(new Set(links.map(l => l.account_id))).toEqual(new Set([account.id]))
  })

  it('recordChats updates chat name and dialog_date on conflict', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const dialogsV1: CoreDialog[] = [
      {
        id: 1,
        name: 'Old Name',
        type: 'user',
        lastMessageDate: new Date('2024-01-01T00:00:00Z'),
      },
    ]

    await chatModels.recordChats(db, dialogsV1, account.id)

    const dialogsV2: CoreDialog[] = [
      {
        id: 1,
        name: 'New Name',
        type: 'user',
        lastMessageDate: new Date('2024-02-01T00:00:00Z'),
      },
    ]

    await chatModels.recordChats(db, dialogsV2, account.id)

    const [chat] = await db.select().from(joinedChatsTable)

    expect(chat.chat_name).toBe('New Name')
  })

  it('fetchChats returns all telegram chats ordered by dialog_date desc', async () => {
    const db = await setupDb()

    await db.insert(joinedChatsTable).values([
      {
        platform: 'telegram',
        chat_id: '1',
        chat_name: 'Chat 1',
        chat_type: 'user',
        dialog_date: 1,
      },
      {
        platform: 'telegram',
        chat_id: '2',
        chat_name: 'Chat 2',
        chat_type: 'group',
        dialog_date: 2,
      },
    ])

    const result = await chatModels.fetchChats(db)
    const chats = result.unwrap()

    expect(chats.map(c => c.chat_id)).toEqual(['2', '1'])
  })

  it('fetchChatsByAccountId returns only chats linked to the given account', async () => {
    const db = await setupDb()

    const [account1] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [account2] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-2',
    }).returning()

    const dialogsForAccount1: CoreDialog[] = [
      {
        id: 1,
        name: 'Account1 Chat',
        type: 'user',
        lastMessageDate: new Date('2024-01-01T00:00:00Z'),
      },
    ]

    const dialogsForAccount2: CoreDialog[] = [
      {
        id: 2,
        name: 'Account2 Chat',
        type: 'user',
        lastMessageDate: new Date('2024-01-01T00:00:00Z'),
      },
    ]

    await chatModels.recordChats(db, dialogsForAccount1, account1.id)
    await chatModels.recordChats(db, dialogsForAccount2, account2.id)

    const result = await chatModels.fetchChatsByAccountId(db, account1.id)
    const chats = result.unwrap()

    expect(chats).toHaveLength(1)
    expect(chats[0].chat_name).toBe('Account1 Chat')
  })

  it('isChatAccessibleByAccount returns true only when account is linked to chat', async () => {
    const db = await setupDb()

    const [account1] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [account2] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-2',
    }).returning()

    const dialogs: CoreDialog[] = [
      {
        id: 1,
        name: 'Shared Chat',
        type: 'group',
        lastMessageDate: new Date('2024-01-01T00:00:00Z'),
      },
    ]

    await chatModels.recordChats(db, dialogs, account1.id)

    const okForAccount1 = (await chatModels.isChatAccessibleByAccount(db, account1.id, '1')).unwrap()
    const okForAccount2 = (await chatModels.isChatAccessibleByAccount(db, account2.id, '1')).unwrap()

    expect(okForAccount1).toBe(true)
    expect(okForAccount2).toBe(false)
  })
})
