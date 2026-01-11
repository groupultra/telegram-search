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
        accessHash: 'hash1',
      },
      {
        id: 2,
        name: 'Chat 2',
        type: 'group',
        lastMessageDate: new Date('2024-01-02T00:00:00Z'),
        accessHash: 'hash2',
      },
    ]

    const result = await chatModels.recordChats(db, dialogs, account.id)
    const inserted = result

    expect(inserted).toHaveLength(2)

    const chatsInDb = await db.select().from(joinedChatsTable)
    expect(chatsInDb.map(c => c.chat_name).sort()).toEqual(['Chat 1', 'Chat 2'])
    // Check access_hash in joinedChatsTable - should NOT be there anymore (moved to account_joined_chats)
    // const chat1 = chatsInDb.find(c => c.chat_name === 'Chat 1')
    // expect(chat1?.access_hash).toBe('hash1')

    const links = await db.select().from(accountJoinedChatsTable)
    expect(links).toHaveLength(2)
    expect(new Set(links.map(l => l.account_id))).toEqual(new Set([account.id]))

    // Check access_hash in accountJoinedChatsTable
    // Need to join to find which link corresponds to Chat 1
    const chat1 = chatsInDb.find(c => c.chat_name === 'Chat 1')
    const link1 = links.find(l => l.joined_chat_id === chat1?.id)
    expect(link1?.access_hash).toBe('hash1')
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

  it('recordChatEntity inserts or updates chat info', async () => {
    const db = await setupDb()
    const accountId = '11111111-1111-1111-1111-111111111111'

    // Create account for linking
    await db.insert(accountsTable).values({
      id: accountId,
      platform: 'telegram',
      platform_user_id: 'user-1',
    })

    await chatModels.recordChatEntity(db, {
      id: '1001',
      name: 'Channel 1',
      type: 'channel',
      accessHash: 'ch_hash_1',
    }, accountId)

    const [chat] = await db.select().from(joinedChatsTable)
    expect(chat.chat_id).toBe('1001')
    expect(chat.chat_name).toBe('Channel 1')
    expect(chat.chat_type).toBe('channel')
    // expect(chat.access_hash).toBe('ch_hash_1') // access_hash removed from joined_chats

    const [link] = await db.select().from(accountJoinedChatsTable)
    expect(link).toBeDefined()
    expect(link.access_hash).toBe('ch_hash_1')

    // Update
    await chatModels.recordChatEntity(db, {
      id: '1001',
      name: 'Channel 1 New',
      type: 'channel',
      accessHash: 'ch_hash_2',
    }, accountId)

    const [updated] = await db.select().from(joinedChatsTable)
    expect(updated.chat_name).toBe('Channel 1 New')

    const [updatedLink] = await db.select().from(accountJoinedChatsTable)
    expect(updatedLink.access_hash).toBe('ch_hash_2')
  })

  it('findChatAccessHash returns correct hash and type', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const dialogs: CoreDialog[] = [
      {
        id: 555,
        name: 'Target Chat',
        type: 'channel',
        lastMessageDate: new Date(),
        accessHash: 'target_hash',
      },
    ]

    await chatModels.recordChats(db, dialogs, account.id)

    const result = (await chatModels.findChatAccessHash(db, account.id, '555')).unwrap()
    expect(result).not.toBeNull()
    expect(result?.accessHash).toBe('target_hash')
    expect(result?.type).toBe('channel')

    const notFound = (await chatModels.findChatAccessHash(db, account.id, '999')).unwrap()
    expect(notFound).toBeNull()
  })

  it('updateChatPts updates pts for a specific chat for an account', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: '12345',
      chat_name: 'Test Chat',
      chat_type: 'channel',
    }).returning()

    await db.insert(accountJoinedChatsTable).values({
      account_id: account.id,
      joined_chat_id: chat.id,
      pts: 1000,
    })

    // Update with larger pts
    await chatModels.updateChatPts(db, account.id, '12345', 2000)

    const [link1] = await db.select().from(accountJoinedChatsTable)
    expect(link1.pts).toBe(2000)

    // Attempt update with smaller pts
    await chatModels.updateChatPts(db, account.id, '12345', 1500)

    const [link2] = await db.select().from(accountJoinedChatsTable)
    expect(link2.pts).toBe(2000) // Should still be 2000 due to GREATEST()
  })
})
