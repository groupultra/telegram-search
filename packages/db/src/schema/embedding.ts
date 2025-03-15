import type { EmbeddingTableConfig } from './types'

import { useDB } from '@tg-search/common'
import { and, eq, sql } from 'drizzle-orm'
import { bigint, integer, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core'
import { nanoid } from 'nanoid'

export const embedding_models = pgTable('embedding_models', {
  id: text('id').primaryKey().$defaultFn(() => nanoid(6)),
  model_name: text('model_name').notNull(),
  vector_dimensions: integer('vector_dimensions').notNull(),
  create_at: timestamp('create_at').notNull().defaultNow(),
  update_at: timestamp('update_at').notNull().defaultNow(),
})

export async function getEmbeddingModelsTable(chatId: number, model_config: EmbeddingTableConfig) {
  let models = await useDB().select().from(embedding_models).where(and(eq(embedding_models.model_name, model_config.model), eq(embedding_models.vector_dimensions, model_config.dimensions)))
  if (models.length === 0) {
    models = await useDB().insert(embedding_models).values({
      model_name: model_config.model,
      vector_dimensions: model_config.dimensions,
    }).returning()
  }
  return models[0]
}
// 获取embedding表
export async function getEmbeddingTable(chatId: number, model_config: EmbeddingTableConfig) {
  const model = await getEmbeddingModelsTable(chatId, model_config)
  const tableName = `embedding_${chatId}_${model.id}`
  return pgTable(tableName, {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: bigint('chat_id', { mode: 'number' }).notNull(),
    embedding: vector('embedding', { dimensions: model_config.dimensions }),
    messageId: uuid('message_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  })
}

// 使用embedding表
export async function useEmbeddingTable(chatId: number, model_config: EmbeddingTableConfig) {
  const model = await getEmbeddingModelsTable(chatId, model_config)
  const tableName = `embedding_${chatId}_${model.id}`
  const table = getEmbeddingTable(chatId, model_config)

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
