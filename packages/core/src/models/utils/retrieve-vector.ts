import type { CorePagination } from '@tg-search/common'

import type { DBRetrievalMessages } from './message'

import { EmbeddingDimension, useConfig } from '@tg-search/common'
import { and, desc, eq, gt, sql } from 'drizzle-orm'

import { withDb } from '../../db'
import { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import { chatMessagesTable } from '../../schemas/chat-messages'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { getSimilaritySql } from './similarity'

export async function retrieveVector(
  accountId: string,
  chatId: string | undefined,
  embedding: number[],
  pagination?: CorePagination,
  filters?: {
    fromUserId?: string
    timeRange?: { start?: number, end?: number }
  },
): Promise<DBRetrievalMessages[]> {
  const similarity = getSimilaritySql(
    useConfig().api.embedding.dimension || EmbeddingDimension.DIMENSION_1536,
    embedding,
  )

  const timeRelevance = sql<number>`(1 - (CEIL(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint - ${chatMessagesTable.created_at}) / 86400 / 30)`
  const combinedScore = sql<number>`((1.2 * ${similarity}) + (0.2 * ${timeRelevance}))`

  // Build where conditions
  const whereConditions = [
    eq(chatMessagesTable.platform, 'telegram'),
    chatId ? eq(chatMessagesTable.in_chat_id, chatId) : undefined,
    gt(similarity, 0.5),
    filters?.fromUserId ? eq(chatMessagesTable.from_id, filters.fromUserId) : undefined,
    filters?.timeRange?.start ? sql`${chatMessagesTable.platform_timestamp} >= ${filters.timeRange.start}` : undefined,
    filters?.timeRange?.end ? sql`${chatMessagesTable.platform_timestamp} <= ${filters.timeRange.end}` : undefined,
  ].filter(Boolean)

  // Get top messages with similarity above threshold
  return (await withDb(db => db
    .select({
      id: chatMessagesTable.id,
      platform: chatMessagesTable.platform,
      platform_message_id: chatMessagesTable.platform_message_id,
      from_id: chatMessagesTable.from_id,
      from_name: chatMessagesTable.from_name,
      from_user_uuid: chatMessagesTable.from_user_uuid,
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
      chat_name: joinedChatsTable.chat_name,
    })
    .from(chatMessagesTable)
    .innerJoin(joinedChatsTable, eq(chatMessagesTable.in_chat_id, joinedChatsTable.chat_id))
    .innerJoin(
      accountJoinedChatsTable,
      and(
        eq(accountJoinedChatsTable.joined_chat_id, joinedChatsTable.id),
        eq(accountJoinedChatsTable.account_id, accountId),
      ),
    )
    .where(and(...whereConditions))
    .orderBy(desc(sql`combined_score`))
    .limit(pagination?.limit || 20),
  )).expect('Failed to fetch relevant messages')
}
