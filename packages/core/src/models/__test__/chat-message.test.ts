import type { CorePagination } from '@tg-search/common'

import type { CoreMessage } from '../../types/message'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import { accountsTable } from '../../schemas/accounts'
import { chatMessagesTable } from '../../schemas/chat-messages'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { photosTable } from '../../schemas/photos'
import { usersTable } from '../../schemas/users'
import { chatMessageModels } from '../chat-message'
import { photoModels } from '../photos'

async function setupDb() {
  return mockDB({
    accountsTable,
    accountJoinedChatsTable,
    joinedChatsTable,
    chatMessagesTable,
    photosTable,
    usersTable,
  })
}

function buildCoreMessage(overrides: Partial<CoreMessage> = {}): CoreMessage {
  return {
    uuid: overrides.uuid ?? 'uuid-1',
    platform: 'telegram',
    platformMessageId: overrides.platformMessageId ?? '1',
    chatId: overrides.chatId ?? 'chat-1',
    fromId: overrides.fromId ?? 'from-1',
    fromName: overrides.fromName ?? 'From 1',
    content: overrides.content ?? 'content',
    reply: overrides.reply ?? { isReply: false, replyToId: undefined, replyToName: undefined },
    forward: overrides.forward ?? { isForward: false },
    platformTimestamp: overrides.platformTimestamp ?? Date.now(),
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
    deletedAt: overrides.deletedAt,
    media: overrides.media,
    fromUserUuid: overrides.fromUserUuid,
  }
}

describe('models/chat-message', () => {
  async function accountIsolationFixture() {
    const db = await setupDb()
    const [owner, other] = await db.insert(accountsTable).values([
      { platform: 'telegram', platform_user_id: 'owner' },
      { platform: 'telegram', platform_user_id: 'other' },
    ]).returning()
    const [visible, hidden] = await db.insert(joinedChatsTable).values([
      { platform: 'telegram', chat_id: 'visible-group', chat_type: 'group' },
      { platform: 'telegram', chat_id: 'hidden-group', chat_type: 'group' },
    ]).returning()
    await db.insert(accountJoinedChatsTable).values([
      { account_id: owner.id, joined_chat_id: visible.id },
      { account_id: other.id, joined_chat_id: hidden.id },
    ])
    await chatMessageModels.recordMessages(db, owner.id, [buildCoreMessage({ chatId: visible.chat_id, platformTimestamp: 10 })])
    await chatMessageModels.recordMessages(db, other.id, [buildCoreMessage({ chatId: hidden.chat_id, platformTimestamp: 20 })])
    return { db, owner, visible, hidden }
  }

  it('excludes another account group from time-range queries, including explicit chat filters', async () => {
    const { db, owner, visible, hidden } = await accountIsolationFixture()
    const result = (await chatMessageModels.fetchMessagesByTimeRange(db, owner.id, { start: 0, end: 100 })).unwrap()
    expect(result.map(message => message.in_chat_id)).toEqual([visible.chat_id])
    expect((await chatMessageModels.fetchMessagesByTimeRange(db, owner.id, { start: 0, end: 100 }, [hidden.chat_id])).unwrap()).toEqual([])
  })

  it('denies guessed message context in another account group', async () => {
    const { db, owner, visible, hidden } = await accountIsolationFixture()
    const read = (chatId: string) => chatMessageModels.fetchMessageContextWithPhotos(db, photoModels, owner.id, { chatId, messageId: '1', before: 1, after: 1 })
    expect((await read(hidden.chat_id)).unwrap()).toEqual([])
    expect((await read(visible.chat_id)).unwrap().map(message => message.chatId)).toEqual([visible.chat_id])
  })

  it('recordMessages scopes owner_account_id only for private (user) chats', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [privateChat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-private',
      chat_name: 'Private Chat',
      chat_type: 'user',
    }).returning()

    const [groupChat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-group',
      chat_name: 'Group Chat',
      chat_type: 'group',
    }).returning()

    const messages: CoreMessage[] = [
      buildCoreMessage({
        uuid: uuidv4(),
        platformMessageId: '1',
        chatId: privateChat.chat_id,
        content: 'private message',
      }),
      buildCoreMessage({
        uuid: uuidv4(),
        platformMessageId: '2',
        chatId: groupChat.chat_id,
        content: 'group message',
      }),
    ]

    const result = await chatMessageModels.recordMessages(db, account.id, messages)
    const affectedRows = result
    expect(affectedRows).toHaveLength(2)

    const selectedRows = await db
      .select()
      .from(chatMessagesTable)
      .orderBy(chatMessagesTable.platform_message_id)

    expect(selectedRows).toHaveLength(2)
    const privateRow = selectedRows[0]
    const groupRow = selectedRows[1]

    expect(privateRow.in_chat_type).toBe('user')
    expect(privateRow.owner_account_id).toBe(account.id)

    expect(groupRow.in_chat_type).toBe('group')
    expect(groupRow.owner_account_id).toBeNull()
  })

  it('fetchMessages enforces ACL and returns messages ordered by created_at desc', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [otherAccount] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-2',
    }).returning()

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-1',
      chat_name: 'Private Chat',
      chat_type: 'user',
    }).returning()

    await db.insert(chatMessagesTable).values([
      // Allowed message: owned by account
      {
        platform: 'telegram',
        platform_message_id: '1',
        from_id: 'u1',
        from_name: 'User 1',
        in_chat_id: chat.chat_id,
        in_chat_type: 'user',
        content: 'allowed-1',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 1000,
        created_at: 1000,
        owner_account_id: account.id,
      },
      // Not allowed: owned by other account
      {
        platform: 'telegram',
        platform_message_id: '2',
        from_id: 'u2',
        from_name: 'User 2',
        in_chat_id: chat.chat_id,
        in_chat_type: 'user',
        content: 'for-other-account',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 2000,
        created_at: 2000,
        owner_account_id: otherAccount.id,
      },
      // Allowed legacy message: NULL owner
      {
        platform: 'telegram',
        platform_message_id: '3',
        from_id: 'u3',
        from_name: 'User 3',
        in_chat_id: chat.chat_id,
        in_chat_type: 'user',
        content: 'allowed-legacy',
        is_reply: false,
        reply_to_name: '',
        reply_to_id: '',
        platform_timestamp: 3000,
        created_at: 3000,
      },
    ])

    const pagination: CorePagination = { limit: 10, offset: 0 }

    const result = await chatMessageModels.fetchMessages(db, account.id, chat.chat_id, pagination)
    const { dbMessagesResults, coreMessages } = result.unwrap()

    // Should only see 2 messages due to ACL
    expect(dbMessagesResults).toHaveLength(2)
    expect(coreMessages).toHaveLength(2)

    // Ordered by created_at desc => message 3 then message 1
    expect(dbMessagesResults.map(m => m.platform_message_id)).toEqual(['3', '1'])
  })

  it('fetchMessagesWithPhotos attaches media for each message', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-1',
      chat_name: 'Chat with photos',
      chat_type: 'user',
    }).returning()

    const messageUuid = uuidv4()
    const messages: CoreMessage[] = [
      buildCoreMessage({
        uuid: messageUuid,
        platformMessageId: '1',
        chatId: chat.chat_id,
        content: 'with photo',
        platformTimestamp: 1000,
      }),
    ]

    await chatMessageModels.recordMessages(db, account.id, messages)

    const [dbMessage] = await db.select().from(chatMessagesTable)

    await db.insert(photosTable).values({
      platform: 'telegram',
      file_id: 'file-1',
      message_id: dbMessage.id,
      image_bytes: Buffer.from([1, 2, 3]),
      image_mime_type: 'image/jpeg',
    })

    const pagination: CorePagination = { limit: 10, offset: 0 }

    const result = await chatMessageModels.fetchMessagesWithPhotos(db, photoModels, account.id, chat.chat_id, pagination)
    const messagesWithPhotos = result.unwrap()

    expect(messagesWithPhotos).toHaveLength(1)
    const [message] = messagesWithPhotos
    expect(message.media).toBeDefined()
    expect(message.media?.length).toBe(1)
    expect(message.media?.[0].type).toBe('photo')

    // DO NOT USE messageUUID for photos, it's not the message UUID
    expect(message.media?.[0].messageUUID).not.toEqual(messageUuid)
  })

  it('fetchMessageContextWithPhotos returns surrounding messages with media attached', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: 'chat-ctx',
      chat_name: 'Context Chat',
      chat_type: 'user',
    }).returning()

    await db.insert(accountJoinedChatsTable).values({ account_id: account.id, joined_chat_id: chat.id })

    const coreMessages: CoreMessage[] = [
      buildCoreMessage({
        uuid: uuidv4(),
        platformMessageId: '1',
        chatId: chat.chat_id,
        content: 'before',
        platformTimestamp: 1000,
      }),
      buildCoreMessage({
        uuid: uuidv4(),
        platformMessageId: '2',
        chatId: chat.chat_id,
        content: 'target',
        platformTimestamp: 2000,
      }),
      buildCoreMessage({
        uuid: uuidv4(),
        platformMessageId: '3',
        chatId: chat.chat_id,
        content: 'after',
        platformTimestamp: 3000,
      }),
    ]

    await chatMessageModels.recordMessages(db, account.id, coreMessages)

    const dbMessages = await db
      .select()
      .from(chatMessagesTable)
      .orderBy(chatMessagesTable.platform_message_id)

    // Attach one photo per message
    for (const dbMessage of dbMessages) {
      await db.insert(photosTable).values({
        platform: 'telegram',
        file_id: `file-${dbMessage.platform_message_id}`,
        message_id: dbMessage.id,
        image_bytes: Buffer.from([1]),
        image_mime_type: 'image/jpeg',
      })
    }

    const context = (await chatMessageModels.fetchMessageContextWithPhotos(db, photoModels, account.id, {
      chatId: chat.chat_id,
      messageId: '2',
      before: 1,
      after: 1,
    })).unwrap()

    expect(context.map(m => m.platformMessageId)).toEqual(['1', '2', '3'])
    context.forEach((message) => {
      expect(message.media).toBeDefined()
      expect(message.media?.length).toBe(1)
      expect(message.media?.[0].type).toBe('photo')
    })
  })

  it('fetches reply targets by chat-scoped Telegram message ID', async () => {
    // Telegram message IDs repeat across chats, so reply hydration must match
    // both the chat and platform message ID.
    const db = await setupDb()
    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()
    const chats = await db.insert(joinedChatsTable).values([
      { platform: 'telegram', chat_id: 'chat-a', chat_name: 'Chat A', chat_type: 'group' },
      { platform: 'telegram', chat_id: 'chat-b', chat_name: 'Chat B', chat_type: 'group' },
    ]).returning()
    await db.insert(chatMessagesTable).values(chats.map((chat, index) => ({
      platform: 'telegram',
      platform_message_id: '7',
      from_id: `sender-${index}`,
      from_name: `Sender ${index}`,
      in_chat_id: chat.chat_id,
      in_chat_type: 'group' as const,
      content: `content-${chat.chat_id}`,
      platform_timestamp: index + 1,
    })))

    const result = (await chatMessageModels.fetchMessagesByChatAndPlatformIds(
      db,
      account.id,
      [{ chatId: 'chat-a', messageId: '7' }],
    )).unwrap()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ in_chat_id: 'chat-a', platform_message_id: '7', content: 'content-chat-a' })
  })
})
