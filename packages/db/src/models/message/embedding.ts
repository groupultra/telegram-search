import type { MessageWithSimilarity, SearchOptions } from './types'

import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'

import { useMessageTable } from '../../schema'

/**
 * Update message embedding in partition table
 */
export async function updateMessageEmbeddings(chatId: number, updates: Array<{ id: number, embedding: number[] }>) {
  const contentTable = `messages_${chatId}`

  // Update embeddings in batch
  await Promise.all(
    updates.map(async ({ id, embedding }) => {
      await useDB().execute(sql`
        UPDATE ${sql.identifier(contentTable)}
        SET embedding = ${sql.raw(`'[${embedding.join(',')}]'`)}::vector
        WHERE id = ${id} AND chat_id = ${chatId}
      `)
    }),
  )
}

/**
 * Find similar messages by vector similarity
 */
export async function findSimilarMessages(embedding: number[], options: SearchOptions): Promise<MessageWithSimilarity[]> {
  const {
    chatId,
    type,
    startTime,
    endTime,
    limit = 10,
    offset = 0,
  } = options

  // Get message table for this chat
  const messageTable = await useMessageTable(chatId)
  const embeddingStr = `'[${embedding.join(',')}]'`

  // Query similar messages using vector similarity
  return useDB()
    .select({
      id: messageTable.id,
      chatId: messageTable.chatId,
      type: messageTable.type,
      content: messageTable.content,
      createdAt: messageTable.createdAt,
      fromId: messageTable.fromId,
      similarity: sql<number>`1 - (${messageTable.embedding} <=> ${sql.raw(embeddingStr)}::vector)`.as('similarity'),
    })
    .from(messageTable)
    .where(sql`
      ${messageTable.embedding} IS NOT NULL
      ${type ? sql`AND type = ${type}` : sql``}
      ${startTime ? sql`AND created_at >= ${startTime}` : sql``}
      ${endTime ? sql`AND created_at <= ${endTime}` : sql``}
    `)
    .orderBy(sql`${messageTable.embedding} <=> ${sql.raw(embeddingStr)}::vector`)
    .limit(limit)
    .offset(offset)
}
