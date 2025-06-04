// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/chat-message.ts

import type { CoreMessage } from '../utils/message'
import type { CorePagination } from '../utils/pagination'
import type { DBRetrievalMessages } from './utils/message'

import { desc, eq } from 'drizzle-orm'

import { withDb } from '../db'
import { chatMessagesTable } from '../db/schema'
import { Ok } from '../utils/monad'
import { convertToCoreMessageFromDB, convertToDBInsertMessage } from './utils/message'
import { retrieveJieba } from './utils/retrieve-jieba'
import { retrieveVector } from './utils/retrieve-vector'

export async function recordMessages(messages: CoreMessage[]) {
  const dbMessages = messages.map(convertToDBInsertMessage)

  if (dbMessages.length === 0) {
    return
  }

  (await withDb(async db => Ok(await db
    .insert(chatMessagesTable)
    .values(dbMessages)
    .onConflictDoNothing({
      // TODO: on conflict replace
      target: [chatMessagesTable.platform, chatMessagesTable.platform_message_id, chatMessagesTable.in_chat_id],
    })),
  )).expect('Failed to record messages')
}

export async function fetchMessages(chatId: string, pagination: CorePagination): Promise<CoreMessage[]> {
  const dbMessagesResults = (await withDb(db => db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.in_chat_id, chatId))
    .orderBy(desc(chatMessagesTable.created_at))
    .limit(pagination.limit)
    .offset(pagination.offset),
  )).expect('Failed to fetch messages')

  const coreMessages = dbMessagesResults.map(convertToCoreMessageFromDB)

  return coreMessages
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
