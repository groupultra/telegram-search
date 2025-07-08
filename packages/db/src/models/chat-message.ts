import type { UUID } from 'node:crypto'
// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/chat-message.ts

import type { CorePagination } from '@tg-search/common/utils/pagination'

import type { CoreMessage, CoreMessageMedia } from '../../../core/src'
import type { DBRetrievalMessages } from './utils/message'

import { useLogger } from '@tg-search/common'
import { Ok } from '@tg-search/common/utils/monad'
import { desc, eq, sql } from 'drizzle-orm'

import { withDb } from '../drizzle'
import { chatMessagesTable } from '../schemas/chat_messages'
import { findPhotosByMessageIds, recordPhotos } from './photos'
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
        content: sql`excluded.content`,
        updated_at: Date.now(),
      },
    })
    .returning(),
  )
}

export async function recordMessagesWithPhotos(messages: CoreMessage[]): Promise<void> {
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
        .map(media => ({
          ...media,
          messageUUID: dbMessage?.id as UUID,
        })) || []
    }) satisfies CoreMessageMedia[]

  if (allPhotoMedia.length > 0) {
    await recordPhotos(allPhotoMedia)
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

export async function retrieveMessages(
  chatId: string | undefined,
  content: {
    text?: string
    embedding?: number[]
  },
  pagination?: CorePagination,
) {
  const retrievalMessages: DBRetrievalMessages[] = []

  if (content.text) {
    const relevantMessages = await retrieveJieba(chatId, content.text, pagination)
    retrievalMessages.push(...relevantMessages)
  }

  if (content.embedding && content.embedding.length !== 0) {
    const relevantMessages = await retrieveVector(chatId, content.embedding, pagination)
    retrievalMessages.push(...relevantMessages)
  }

  return Ok(retrievalMessages)
}
