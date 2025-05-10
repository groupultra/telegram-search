import type { CorePagination } from '../../utils/pagination'
import type { DBRetrivalMessages } from './message'

import { EmbeddingDimension } from '@tg-search/common'
import { useConfig } from '@tg-search/common/composable'
import { and, desc, eq, gt, sql } from 'drizzle-orm'

import { withDb } from '../../db'
import { chatMessagesTable } from '../../db/schema'
import { getSimilaritySql } from './similarity'

export async function retriveVector(chatId: string | undefined, embedding: number[], pagination?: CorePagination): Promise<DBRetrivalMessages[]> {
  const similarity = getSimilaritySql(
    useConfig().api.embedding.dimension || EmbeddingDimension.DIMENSION_1536,
    embedding,
  )

  const timeRelevance = sql<number>`(1 - (CEIL(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint - ${chatMessagesTable.created_at}) / 86400 / 30)`
  const combinedScore = sql<number>`((1.2 * ${similarity}) + (0.2 * ${timeRelevance}))`

  // Get top messages with similarity above threshold
  return (await withDb(db => db
    .select({
      id: chatMessagesTable.id,
      platform: chatMessagesTable.platform,
      platform_message_id: chatMessagesTable.platform_message_id,
      from_id: chatMessagesTable.from_id,
      from_name: chatMessagesTable.from_name,
      in_chat_id: chatMessagesTable.in_chat_id,
      content: chatMessagesTable.content,
      is_reply: chatMessagesTable.is_reply,
      reply_to_name: chatMessagesTable.reply_to_name,
      reply_to_id: chatMessagesTable.reply_to_id,
      created_at: chatMessagesTable.created_at,
      updated_at: chatMessagesTable.updated_at,
      deleted_at: chatMessagesTable.deleted_at,
      platform_timestamp: chatMessagesTable.platform_timestamp,
      jieba_tokens: chatMessagesTable.jieba_tokens,
      similarity: sql<number>`${similarity} AS "similarity"`,
      time_relevance: sql<number>`${timeRelevance} AS "time_relevance"`,
      combined_score: sql<number>`${combinedScore} AS "combined_score"`,
    })
    .from(chatMessagesTable)
    .where(and(
      eq(chatMessagesTable.platform, 'telegram'),
      chatId ? eq(chatMessagesTable.in_chat_id, chatId) : undefined,
      gt(similarity, 0.5),
      // notInArray(chatMessagesTable.platform_message_id, excludeMessageIds),
    ))
    .orderBy(desc(sql`combined_score`))
    .limit(pagination?.limit || 20),
  )).expect('Failed to fetch relevant messages')
}
