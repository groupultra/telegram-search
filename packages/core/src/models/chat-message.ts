// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/chat-message.ts

import type { Logger } from '@guiiai/logg'
import type { CorePagination } from '@tg-search/common'

import type { CoreDB, CoreTransaction } from '../db'
import type { JoinedChatType } from '../schemas/joined-chats'
import type { EmbeddingDimension } from '../types/account-settings'
import type { StorageMessageContextParams } from '../types/events'
import type { CoreMessage } from '../types/message'
import type { PromiseResult } from '../utils/result'
import type { PhotoModels } from './photos'
import type { DBRetrievalMessages } from './utils/message'
import type { DBInsertMessage, DBSelectMessage } from './utils/types'

import { and, asc, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm'

import { chatMessagesTable } from '../schemas/chat-messages'
import { joinedChatsTable } from '../schemas/joined-chats'
import { withResult } from '../utils/result'
import { convertToCoreMessageFromDB, convertToDBInsertMessage } from './utils/message'
import { convertDBPhotoToCoreMessageMedia } from './utils/photos'
import { retrieveJieba } from './utils/retrieve-jieba'
import { retrieveVector } from './utils/retrieve-vector'

/**
 * Upsert messages for a specific account.
 * NOTE: Without result wrapper, because it's insert operation, maybe outer don't receive any error, just throw error directly.
 */
async function recordMessages(
  tx: CoreTransaction | CoreDB,
  accountId: string,
  messages: CoreMessage[],
): Promise<DBInsertMessage[]> {
  if (messages.length === 0) {
    return []
  }

  // Resolve chat types in batch so we can decide whether to scope messages
  // to an owning account (private dialogs) or keep them shared (groups/channels).
  const chatIds = Array.from(new Set(messages.map(message => message.chatId)))

  const chatRows = await tx
    .select({
      chat_id: joinedChatsTable.chat_id,
      chat_type: joinedChatsTable.chat_type,
    })
    .from(joinedChatsTable)
    .where(inArray(joinedChatsTable.chat_id, chatIds))

  const chatTypeById = new Map<string, JoinedChatType>()
  for (const row of chatRows)
    chatTypeById.set(row.chat_id, row.chat_type)

  const dbMessages = messages.map((message) => {
    // In normal flows, every chatId should already exist in joined_chats and
    // provide a concrete chat_type. However, real-time or out-of-order events
    // (e.g. new messages arriving before dialogs are persisted) can leave us
    // without a row, which would otherwise cause a NULL in_chat_type write and
    // violate the NOT NULL constraint. To keep storage robust, fall back to
    // treating unknown chats as private 'user' dialogs, which errs on the side
    // of stricter ACL (scoped to the current account) instead of over-sharing.
    const chatType: JoinedChatType = chatTypeById.get(message.chatId) ?? 'user'

    // Only scope by account for private dialogs; keep group/channel messages shared.
    const ownerAccountId = chatType === 'user' ? accountId : null
    return convertToDBInsertMessage(ownerAccountId, chatType, message)
  })

  if (dbMessages.length === 0)
    return []

  const rows = await tx
    .insert(chatMessagesTable)
    .values(dbMessages)
    .onConflictDoUpdate({
      target: [
        chatMessagesTable.platform,
        chatMessagesTable.platform_message_id,
        chatMessagesTable.in_chat_id,
        chatMessagesTable.owner_account_id,
      ],
      set: {
        // Content: always update with new content
        content: sql`excluded.content`,

        // User UUID: update if not null
        from_user_uuid: sql`COALESCE(excluded.from_user_uuid, ${chatMessagesTable.from_user_uuid})`,

        // From name: always update (for backward compatibility)
        from_name: sql`excluded.from_name`,

        // Vectors: update only if not null (vectors can be null in schema)
        content_vector_1024: sql`COALESCE(excluded.content_vector_1024, ${chatMessagesTable.content_vector_1024})`,
        content_vector_1536: sql`COALESCE(excluded.content_vector_1536, ${chatMessagesTable.content_vector_1536})`,
        content_vector_768: sql`COALESCE(excluded.content_vector_768, ${chatMessagesTable.content_vector_768})`,

        // Jieba tokens: update only if new array is not empty
        jieba_tokens: sql`CASE
          WHEN excluded.jieba_tokens IS NOT NULL
               AND jsonb_array_length(excluded.jieba_tokens) > 0
          THEN excluded.jieba_tokens
          ELSE ${chatMessagesTable.jieba_tokens}
        END`,

        // Platform timestamp: always update
        platform_timestamp: sql`excluded.platform_timestamp`,
        updated_at: Date.now(),
      },
    })
    .returning()

  return rows
}

/**
 * Fetch messages for a specific account.
 */
async function fetchMessages(
  db: CoreDB,
  accountId: string,
  chatId: string,
  pagination: CorePagination,
): PromiseResult<{ dbMessagesResults: DBSelectMessage[], coreMessages: CoreMessage[] }> {
  return withResult(async () => {
    const dbMessagesResults = await db
      .select({
        chat_messages: chatMessagesTable,
        joined_chats: joinedChatsTable,
      })
      .from(chatMessagesTable)
      .innerJoin(joinedChatsTable, eq(chatMessagesTable.in_chat_id, joinedChatsTable.chat_id))
      .where(and(
        eq(chatMessagesTable.in_chat_id, chatId),
        // ACL: for private dialogs, only return messages owned by this account (or legacy NULL owner).
        sql`(
        ${joinedChatsTable.chat_type} != 'user'
        OR ${chatMessagesTable.owner_account_id} = ${accountId}
        OR ${chatMessagesTable.owner_account_id} IS NULL
      )`,
      ))
      .orderBy(desc(chatMessagesTable.created_at))
      .limit(pagination.limit)
      .offset(pagination.offset)

    return {
      dbMessagesResults: dbMessagesResults.map(row => row.chat_messages),
      coreMessages: dbMessagesResults.map(row => convertToCoreMessageFromDB(row.chat_messages)),
    }
  })
}

/**
 * Fetch messages with photos for a specific account.
 */
async function fetchMessagesWithPhotos(
  db: CoreDB,
  photoModel: PhotoModels,
  accountId: string,
  chatId: string,
  pagination: CorePagination,
): PromiseResult<CoreMessage[]> {
  return withResult(async () => {
    const { dbMessagesResults, coreMessages } = (await fetchMessages(db, accountId, chatId, pagination)).expect('Failed to fetch messages')

    // Fetch photos for all messages in batch
    const messageIds = dbMessagesResults.map(msg => msg.id)
    const photos = (await photoModel.findPhotosByMessageIds(db, messageIds)).expect('Failed to fetch photos')

    // Group photos by message_id
    const photosByMessage = Object.groupBy(
      photos.filter(photo => photo.message_id),
      photo => photo.message_id!,
    )

    // Attach photos to messages with proper type conversion
    return coreMessages.map((message, index) => ({
      ...message,
      media: (photosByMessage[dbMessagesResults[index].id] || [])
        .map(convertDBPhotoToCoreMessageMedia),
    }) satisfies CoreMessage)
  })
}

/**
 * Fetch message context with photos for a specific account.
 */
async function fetchMessageContextWithPhotos(
  db: CoreDB,
  photoModel: PhotoModels,
  accountId: string,
  { chatId, messageId, before, after }: Required<StorageMessageContextParams>,
): PromiseResult<CoreMessage[]> {
  return withResult(async () => {
    const targetMessages = await db
      .select({
        chat_messages: chatMessagesTable,
        joined_chats: joinedChatsTable,
      })
      .from(chatMessagesTable)
      .innerJoin(joinedChatsTable, eq(chatMessagesTable.in_chat_id, joinedChatsTable.chat_id))
      .where(and(
        eq(chatMessagesTable.in_chat_id, chatId),
        eq(chatMessagesTable.platform_message_id, messageId),
        sql`(
        ${joinedChatsTable.chat_type} != 'user'
        OR ${chatMessagesTable.owner_account_id} = ${accountId}
        OR ${chatMessagesTable.owner_account_id} IS NULL
      )`,
      ))
      .limit(1)

    if (targetMessages.length === 0)
      return []

    const targetMessage = targetMessages[0].chat_messages

    const previousMessages = await db
      .select({
        chat_messages: chatMessagesTable,
        joined_chats: joinedChatsTable,
      })
      .from(chatMessagesTable)
      .innerJoin(joinedChatsTable, eq(chatMessagesTable.in_chat_id, joinedChatsTable.chat_id))
      .where(and(
        eq(chatMessagesTable.in_chat_id, chatId),
        lt(chatMessagesTable.platform_timestamp, targetMessage.platform_timestamp),
        sql`(
        ${joinedChatsTable.chat_type} != 'user'
        OR ${chatMessagesTable.owner_account_id} = ${accountId}
        OR ${chatMessagesTable.owner_account_id} IS NULL
      )`,
      ))
      .orderBy(desc(chatMessagesTable.platform_timestamp))
      .limit(before)

    const nextMessages = await db
      .select({
        chat_messages: chatMessagesTable,
        joined_chats: joinedChatsTable,
      })
      .from(chatMessagesTable)
      .innerJoin(joinedChatsTable, eq(chatMessagesTable.in_chat_id, joinedChatsTable.chat_id))
      .where(and(
        eq(chatMessagesTable.in_chat_id, chatId),
        gt(chatMessagesTable.platform_timestamp, targetMessage.platform_timestamp),
        sql`(
        ${joinedChatsTable.chat_type} != 'user'
        OR ${chatMessagesTable.owner_account_id} = ${accountId}
        OR ${chatMessagesTable.owner_account_id} IS NULL
      )`,
      ))
      .orderBy(asc(chatMessagesTable.platform_timestamp))
      .limit(after)

    const combinedDbMessages = [
      ...previousMessages.map(row => row.chat_messages).reverse(),
      targetMessage,
      ...nextMessages.map(row => row.chat_messages),
    ]

    if (combinedDbMessages.length === 0)
      return []

    const messageIds = combinedDbMessages.map(msg => msg.id)
    const photos = (await photoModel.findPhotosByMessageIds(db, messageIds)).expect('Failed to fetch photos')
    const photosByMessage = Object.groupBy(
      photos.filter(photo => photo.message_id),
      photo => photo.message_id!,
    )

    return combinedDbMessages.map(message => ({
      ...convertToCoreMessageFromDB(message),
      media: (photosByMessage[message.id] || [])
        .map(convertDBPhotoToCoreMessageMedia),
    }) satisfies CoreMessage)
  })
}

/**
 * Retrieve messages for a specific account.
 */
async function retrieveMessages(
  db: CoreDB,
  logger: Logger,
  accountId: string,
  embeddingDimension: EmbeddingDimension,
  content: {
    text?: string
    embedding?: number[]
  },
  pagination?: CorePagination,
  filters?: {
    fromUserId?: string
    timeRange?: { start?: number, end?: number }
    chatIds?: string[]
  },
): PromiseResult<DBRetrievalMessages[]> {
  logger = logger.withContext('models:chat-message:retrieveMessages')

  return withResult(async () => {
    const retrievalMessages: DBRetrievalMessages[] = []

    if (content.text) {
      const relevantMessages = await retrieveJieba(db, logger, accountId, content.text, pagination, filters)
      logger.withFields({ count: relevantMessages.length }).verbose('Retrieved jieba messages')
      retrievalMessages.push(...relevantMessages)
    }

    if (content.embedding && content.embedding.length !== 0) {
      const relevantMessages = await retrieveVector(db, accountId, content.embedding, embeddingDimension, pagination, filters)
      logger.withFields({ count: relevantMessages.length }).verbose('Retrieved vector messages')
      retrievalMessages.push(...relevantMessages)
    }

    return retrievalMessages
  })
}

export const chatMessageModels = {
  recordMessages,
  fetchMessages,
  fetchMessagesWithPhotos,
  fetchMessageContextWithPhotos,
  retrieveMessages,
}

export type ChatMessageModels = typeof chatMessageModels
