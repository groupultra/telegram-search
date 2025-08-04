// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/db/schema.ts

import { bigint, boolean, index, jsonb, pgTable, text, uniqueIndex, uuid, vector } from 'drizzle-orm/pg-core'

export const chatMessagesTable = pgTable('chat_messages', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text().notNull().default(''),
  platform_message_id: text().notNull().default(''),
  from_id: text().notNull().default(''),
  from_name: text().notNull().default(''),
  in_chat_id: text().notNull().default(''),
  content: text().notNull().default(''),
  is_reply: boolean().notNull().default(false),
  reply_to_name: text().notNull().default(''),
  reply_to_id: text().notNull().default(''),
  platform_timestamp: bigint({ mode: 'number' }).notNull().default(0),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  deleted_at: bigint({ mode: 'number' }).notNull().default(0),
  content_vector_1536: vector({ dimensions: 1536 }),
  content_vector_1024: vector({ dimensions: 1024 }),
  content_vector_768: vector({ dimensions: 768 }),
  jieba_tokens: jsonb().notNull().default([]),
}, table => [
  uniqueIndex('chat_messages_platform_platform_message_id_in_chat_id_unique_index').on(table.platform, table.platform_message_id, table.in_chat_id),
  index('chat_messages_content_vector_1536_index').using('hnsw', table.content_vector_1536.op('vector_cosine_ops')),
  index('chat_messages_content_vector_1024_index').using('hnsw', table.content_vector_1024.op('vector_cosine_ops')),
  index('chat_messages_content_vector_768_index').using('hnsw', table.content_vector_768.op('vector_cosine_ops')),
  index('jieba_tokens_index').using('gin', table.jieba_tokens.op('jsonb_path_ops')),
])
