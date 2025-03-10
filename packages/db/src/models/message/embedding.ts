// import type { Message } from '../../schema/message'
import type { EmbeddingTableConfig } from '../../schema/types'
import type { MessageCreateInput as Message, MessageWithSimilarity, SearchOptions } from './types'

import { useDB } from '@tg-search/common'
import { eq, sql } from 'drizzle-orm'

import { useMessageTable } from '../../schema'
import { getEmbeddingTable } from '../../schema/embedding'

/**
 * 创建消息嵌入
 */
export async function updateMessageEmbeddings(chatId: number, updates: Array<{ id: number, embedding: number[] }>, model_config: EmbeddingTableConfig): Promise<void> {
  const table = getEmbeddingTable(model_config)
  // 使用sql.raw来插入向量
  await useDB().insert(table).values(updates.map(update => ({
    chatId,
    id: update.id.toString(),
    embedding: sql`${sql.raw(`'[${update.embedding.join(',')}]'`)}::vector`,
  })))
}

/**
 * 查找没有嵌入的消息
 */
export async function findMessageToEmbed(chatId: number, model_config: EmbeddingTableConfig): Promise<Message[]> {
  const embeddingTable = getEmbeddingTable(model_config)
  const messageTable = await useMessageTable(chatId)

  return useDB()
    .select({
      id: messageTable.id,
      chatId: messageTable.chatId,
      type: messageTable.type,
      content: messageTable.content,
      createdAt: messageTable.createdAt,
      fromId: messageTable.fromId,
      forwardFromChatId: messageTable.forwardFromChatId,
      forwardFromChatName: messageTable.forwardFromChatName,
      forwardFromMessageId: messageTable.forwardFromMessageId,
      views: messageTable.views,
      forwards: messageTable.forwards,
      links: messageTable.links,
      metadata: messageTable.metadata,
      replyToId: messageTable.replyToId,
    })
    .from(messageTable)
    .leftJoin(embeddingTable, eq(messageTable.id, embeddingTable.id))
    .where(sql`${embeddingTable.id} IS NULL AND ${messageTable.chatId} = ${chatId}`)
}

/**
 * 根据相似度查找消息
 */
export async function findSimilarMessages(embedding: number[], model_config: EmbeddingTableConfig, options: SearchOptions): Promise<MessageWithSimilarity[]> {
  const {
    chatId,
    type,
    startTime,
    endTime,
    limit = 10,
    offset = 0,
  } = options
  // 像根据传入的embedding，在embedding表中查找相似的消息
  const messageTable = await useMessageTable(chatId)
  const embeddingTable = getEmbeddingTable(model_config)
  const result = await useDB()
    .select({
      id: sql<number>`CAST(${embeddingTable.id} AS INTEGER)`,
      chatId: embeddingTable.chatId,
      similarity: sql<number>`1 - (${embeddingTable.embedding} <=> ${sql.raw(`'[${embedding.join(',')}]'`)}::vector)`.as('similarity'),
      createdAt: messageTable.createdAt,
      fromId: messageTable.fromId,
      type: messageTable.type,
      content: messageTable.content,
      forwardFromChatId: messageTable.forwardFromChatId,
      forwardFromChatName: messageTable.forwardFromChatName,
      forwardFromMessageId: messageTable.forwardFromMessageId,
      views: messageTable.views,
      forwards: messageTable.forwards,
      links: messageTable.links,
      metadata: messageTable.metadata,
      replyToId: messageTable.replyToId,
    })
    .from(embeddingTable)
    .where(sql`
      ${embeddingTable.embedding} IS NOT NULL
      ${type ? sql`AND type = ${type}` : sql``}
      ${startTime ? sql`AND created_at >= ${startTime}` : sql``}
      ${endTime ? sql`AND created_at <= ${endTime}` : sql``}
    `)
    .orderBy(sql`${embeddingTable.embedding} <=> ${sql.raw(`'[${embedding.join(',')}]'`)}::vector`)
    .limit(limit)
    .offset(offset)
    // 根据id查询消息
    .innerJoin(messageTable, eq(embeddingTable.id, messageTable.id))
  return result as MessageWithSimilarity[]
}
