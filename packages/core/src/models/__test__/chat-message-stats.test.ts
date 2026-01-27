import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountsTable } from '../../schemas/accounts'
import { chatMessagesTable } from '../../schemas/chat-messages'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { usersTable } from '../../schemas/users'
import { chatMessageStatsModels } from '../chat-message-stats'

async function setupDb() {
  return mockDB({
    accountsTable,
    joinedChatsTable,
    chatMessagesTable,
    usersTable,
  })
}

describe('models/chat-message-stats', () => {
  it('getChatMessagesStats aggregates per chat and respects private chat ACL', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [otherAccount] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-2',
    }).returning()

    const [privateChat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'private-chat-1',
      chat_name: 'Private Chat',
      chat_type: 'user',
    }).returning()

    const [groupChat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'group-chat-1',
      chat_name: 'Group Chat',
      chat_type: 'group',
    }).returning()

    await db.insert(chatMessagesTable).values([
      // Private chat, owned by target account -> counted
      {
        platform: 'telegram',
        platform_message_id: '1',
        from_id: 'u1',
        from_name: 'User 1',
        in_chat_id: privateChat.chat_id,
        in_chat_type: 'user',
        content: 'hello',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 1,
        owner_account_id: account.id,
      },
      // Private chat, owned by other account -> NOT counted
      {
        platform: 'telegram',
        platform_message_id: '2',
        from_id: 'u2',
        from_name: 'User 2',
        in_chat_id: privateChat.chat_id,
        in_chat_type: 'user',
        content: 'hidden',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 2,
        owner_account_id: otherAccount.id,
      },
      // Private chat, legacy message with NULL owner -> counted
      {
        platform: 'telegram',
        platform_message_id: '3',
        from_id: 'u3',
        from_name: 'User 3',
        in_chat_id: privateChat.chat_id,
        in_chat_type: 'user',
        content: 'legacy',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 3,
      },
      // Group chat messages are always counted, owner is NULL by design
      {
        platform: 'telegram',
        platform_message_id: '10',
        from_id: 'g1',
        from_name: 'Group User',
        in_chat_id: groupChat.chat_id,
        in_chat_type: 'group',
        content: 'group-1',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 4,
      },
      {
        platform: 'telegram',
        platform_message_id: '11',
        from_id: 'g2',
        from_name: 'Group User 2',
        in_chat_id: groupChat.chat_id,
        in_chat_type: 'group',
        content: 'group-2',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 5,
      },
    ])

    const stats = (await chatMessageStatsModels.getChatMessagesStats(db, account.id)).unwrap()

    const privateStats = stats.find(s => s.chat_id === privateChat.chat_id)
    const groupStats = stats.find(s => s.chat_id === groupChat.chat_id)

    expect(privateStats?.message_count).toBe(2)
    expect(groupStats?.message_count).toBe(2)
  })

  it('getChatMessageStatsByChatId returns stats for a single chat filtered by ACL', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [otherAccount] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-2',
    }).returning()

    const [privateChat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'private-chat-1',
      chat_name: 'Private Chat',
      chat_type: 'user',
    }).returning()

    await db.insert(chatMessagesTable).values([
      // Allowed message for this account
      {
        platform: 'telegram',
        platform_message_id: '1',
        from_id: 'u1',
        from_name: 'User 1',
        in_chat_id: privateChat.chat_id,
        in_chat_type: 'user',
        content: 'allowed-1',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 1000,
        created_at: 1000,
        owner_account_id: account.id,
      },
      // Not allowed (different owner)
      {
        platform: 'telegram',
        platform_message_id: '2',
        from_id: 'u2',
        from_name: 'User 2',
        in_chat_id: privateChat.chat_id,
        in_chat_type: 'user',
        content: 'for-other-account',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 2000,
        created_at: 2000,
        owner_account_id: otherAccount.id,
      },
      // Allowed legacy message (NULL owner)
      {
        platform: 'telegram',
        platform_message_id: '3',
        from_id: 'u3',
        from_name: 'User 3',
        in_chat_id: privateChat.chat_id,
        in_chat_type: 'user',
        content: 'allowed-legacy',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 3000,
        created_at: 3000,
      },
    ])

    const stat = (await chatMessageStatsModels.getChatMessageStatsByChatId(db, account.id, privateChat.chat_id)).unwrap()

    expect(stat.message_count).toBe(2)
    expect(stat.first_message_id).toBe(1)
    expect(stat.latest_message_id).toBe(3)
    expect(stat.first_message_at).toBe(1000)
    expect(stat.latest_message_at).toBe(3000)
  })

  it('normalizes stringly-typed aggregate values returned by DB drivers', async () => {
    const rows = [{
      platform: 'telegram',
      chat_id: 'chat-1',
      chat_name: 'Chat 1',
      message_count: '2',
      first_message_id: '561',
      first_message_at: '1000',
      latest_message_id: '3894496',
      latest_message_at: '3000',
    }]

    // Minimal drizzle-like chain stub that returns string values.
    const db = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              groupBy: () => ({
                limit: async () => rows,
              }),
            }),
          }),
        }),
      }),
    } as any

    const stat = (await chatMessageStatsModels.getChatMessageStatsByChatId(db, 'acc-1', 'chat-1')).unwrap()

    expect(stat.message_count).toBe(2)
    expect(stat.first_message_id).toBe(561)
    expect(stat.latest_message_id).toBe(3894496)
    expect(stat.first_message_at).toBe(1000)
    expect(stat.latest_message_at).toBe(3000)
  })
})
