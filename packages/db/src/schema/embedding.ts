import type { EmbeddingTableConfig } from './types'

import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'
import { bigint, pgTable, timestamp, uuid, vector } from 'drizzle-orm/pg-core'
// 获取embedding表
export function getEmbeddingTable(model_config: EmbeddingTableConfig) {
  return pgTable(`embedding_${model_config.provider}_${model_config.model}`, {
    id: uuid('id').defaultRandom().primaryKey(),
    embedding: vector('embedding', { dimensions: model_config.dimensions }),
    chatId: bigint('chat_id', { mode: 'number' }).notNull(),
    messageId: uuid('message_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  })
}

// 使用embedding表
export async function useEmbeddingTable(model_config: EmbeddingTableConfig) {
  const tableName = `embedding_${model_config.provider}_${model_config.model}`
  const table = getEmbeddingTable(model_config)

  await useDB().execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      embedding VECTOR(${sql.raw(model_config.dimensions.toString())}),
      chat_id BIGINT NOT NULL,
      message_id UUID NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)

  return table
}
