import type { EmbeddingTableConfig } from './types'

import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'
import { bigint, pgTable, timestamp, uuid, vector } from 'drizzle-orm/pg-core'
// 获取embedding表
export function getEmbeddingTable(model_config: EmbeddingTableConfig) {
  return pgTable(`embedding_${model_config.provider}_${model_config.model}`, {
    id: uuid('id').primaryKey(),
    embedding: vector('embedding', { dimensions: 1536 }),
    chatId: bigint('chat_id', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  })
}

// 使用embedding表
export async function useEmbeddingTable(model_config: EmbeddingTableConfig) {
  const table = getEmbeddingTable(model_config)
  await useDB().execute(sql`CREATE TABLE IF NOT EXISTS ${table}`)
  await useDB().execute(sql`CREATE INDEX IF NOT EXISTS embedding_${model_config.provider}_${model_config.model}_idx ON ${table} USING HNSW (embedding)`)
  return table
}
