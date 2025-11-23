// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/chat-message.ts

import type { CorePagination } from '@tg-search/common'

import type { StorageMessageContextParams } from '../types/events'
import type { CoreMessageMediaPhoto, CoreMessageMediaSticker } from '../types/media'
import type { CoreMessage } from '../types/message'
import type { DBRetrievalMessages } from './utils/message'

import { useLogger } from '@guiiai/logg'
import { Ok } from '@unbird/result'
import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm'

import { withDb } from '../db'
import { chatMessagesTable } from '../schemas/chat-messages'
import { findPhotosByMessageIds, recordPhotos } from './photos'
import { recordStickers } from './stickers'
import { convertToCoreMessageFromDB, convertToDBInsertMessage } from './utils/message'
import { convertDBPhotoToCoreMessageMedia } from './utils/photos'
import { retrieveJieba } from './utils/retrieve-jieba'
import { retrieveVector } from './utils/retrieve-vector'

export async function recordMessages(messages: CoreMessage[]) {
  const dbMessages = messages.map(convertToDBInsertMessage)

  if (dbMessages.length === 0) {
    return
  }

  return withDb(async db => db
    .insert(chatMessagesTable)
    .values(dbMessages)
    .onConflictDoUpdate({
      target: [chatMessagesTable.platform, chatMessagesTable.platform_message_id, chatMessagesTable.in_chat_id],
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
    .returning(),
  )
}

export async function recordMessagesWithMedia(messages: CoreMessage[]): Promise<void> {
  if (messages.length === 0) {
    return
  }

  // First, record the messages
  const dbMessages = (await recordMessages(messages))?.expect('Failed to record messages')

  // Then, collect and record photos that are linked to messages
  const allPhotoMedia = messages
    .filter(message => message.media && message.media.length > 0)
    .flatMap((message) => {
      // Update media messageUUID to match the newly inserted message UUID
      const dbMessage = dbMessages?.find(dbMsg =>
        dbMsg.platform_message_id === message.platformMessageId
        && dbMsg.in_chat_id === message.chatId,
      )

      useLogger().withFields({ dbMessageId: dbMessage?.id }).debug('DB message ID')

      return message.media?.filter(media => media.type === 'photo')
        .map((media) => {
          return {
            ...media,
            messageUUID: dbMessage?.id,
          }
        }) || []
    }) satisfies CoreMessageMediaPhoto[]

  const allStickerMedia = messages
    .flatMap(message => message.media ?? [])
    .filter(media => media.type === 'sticker')
    .map((media) => {
      // const emoji = media.apiMedia?.document?.attributes?.find((attr: any) => attr.alt)?.alt ?? ''

      return media
    }) satisfies CoreMessageMediaSticker[]

  if (allPhotoMedia.length > 0) {
    (await recordPhotos(allPhotoMedia))?.expect('Failed to record photos')
  }

  if (allStickerMedia.length > 0) {
    (await recordStickers(allStickerMedia))?.expect('Failed to record stickers')
  }
}

export async function fetchMessages(chatId: string, pagination: CorePagination) {
  const dbMessagesResults = (await withDb(db => db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.in_chat_id, chatId))
    .orderBy(desc(chatMessagesTable.created_at))
    .limit(pagination.limit)
    .offset(pagination.offset),
  )).expect('Failed to fetch messages')

  return Ok({
    dbMessagesResults,
    coreMessages: dbMessagesResults.map(convertToCoreMessageFromDB),
  })
}

export async function fetchMessagesWithPhotos(chatId: string, pagination: CorePagination) {
  const { dbMessagesResults, coreMessages } = (await fetchMessages(chatId, pagination)).unwrap()

  // Fetch photos for all messages in batch
  const messageIds = dbMessagesResults.map(msg => msg.id)
  const photos = (await findPhotosByMessageIds(messageIds)).unwrap()

  // Group photos by message_id
  const photosByMessage = Object.groupBy(
    photos.filter(photo => photo.message_id),
    photo => photo.message_id!,
  )

  // Attach photos to messages with proper type conversion
  return Ok(coreMessages.map((message, index) => ({
    ...message,
    media: (photosByMessage[dbMessagesResults[index].id] || [])
      .map(convertDBPhotoToCoreMessageMedia),
  }) satisfies CoreMessage))
}

export async function fetchMessageContextWithPhotos({ chatId, messageId, before, after }: Required<StorageMessageContextParams>) {
  const targetMessages = (await withDb(db => db
    .select()
    .from(chatMessagesTable)
    .where(and(
      eq(chatMessagesTable.in_chat_id, chatId),
      eq(chatMessagesTable.platform_message_id, messageId),
    ))
    .limit(1),
  )).expect('Failed to locate target message')

  if (targetMessages.length === 0)
    return Ok<CoreMessage[]>([])

  const targetMessage = targetMessages[0]

  const previousMessages = (await withDb(db => db
    .select()
    .from(chatMessagesTable)
    .where(and(
      eq(chatMessagesTable.in_chat_id, chatId),
      lt(chatMessagesTable.platform_timestamp, targetMessage.platform_timestamp),
    ))
    .orderBy(desc(chatMessagesTable.platform_timestamp))
    .limit(before),
  )).expect('Failed to fetch previous messages')

  const nextMessages = (await withDb(db => db
    .select()
    .from(chatMessagesTable)
    .where(and(
      eq(chatMessagesTable.in_chat_id, chatId),
      gt(chatMessagesTable.platform_timestamp, targetMessage.platform_timestamp),
    ))
    .orderBy(asc(chatMessagesTable.platform_timestamp))
    .limit(after),
  )).expect('Failed to fetch next messages')

  const combinedDbMessages = [
    ...previousMessages.reverse(),
    targetMessage,
    ...nextMessages,
  ]

  if (combinedDbMessages.length === 0)
    return Ok<CoreMessage[]>([])

  const messageIds = combinedDbMessages.map(msg => msg.id)
  const photos = (await findPhotosByMessageIds(messageIds)).unwrap()
  const photosByMessage = Object.groupBy(
    photos.filter(photo => photo.message_id),
    photo => photo.message_id!,
  )

  return Ok(combinedDbMessages.map(message => ({
    ...convertToCoreMessageFromDB(message),
    media: (photosByMessage[message.id] || [])
      .map(convertDBPhotoToCoreMessageMedia),
  }) satisfies CoreMessage))
}

export async function retrieveMessages(
  accountId: string,
  chatId: string | undefined,
  content: {
    text?: string
    embedding?: number[]
  },
  pagination?: CorePagination,
  filters?: {
    fromUserId?: string
    timeRange?: { start?: number, end?: number }
  },
) {
  const logger = useLogger('models:chat-message:retrieveMessages')

  const retrievalMessages: DBRetrievalMessages[] = []

  if (content.text) {
    const relevantMessages = await retrieveJieba(accountId, chatId, content.text, pagination, filters)
    logger.withFields({ relevantMessages: relevantMessages.length }).verbose('Retrieved jieba messages')
    retrievalMessages.push(...relevantMessages)
  }

  if (content.embedding && content.embedding.length !== 0) {
    const relevantMessages = await retrieveVector(accountId, chatId, content.embedding, pagination, filters)
    logger.withFields({ relevantMessages: relevantMessages.length }).verbose('Retrieved vector messages')
    retrievalMessages.push(...relevantMessages)
  }

  return Ok(retrievalMessages)
}
