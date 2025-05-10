// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/db/schema.ts

import { sql } from 'drizzle-orm'
import { bigint, boolean, index, integer, jsonb, pgTable, pgView, text, uniqueIndex, uuid, vector } from 'drizzle-orm/pg-core'

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
  uniqueIndex('chat_messages_platform_platform_message_id_unique_index').on(table.platform, table.platform_message_id),
  index('chat_messages_content_vector_1536_index').using('hnsw', table.content_vector_1536.op('vector_cosine_ops')),
  index('chat_messages_content_vector_1024_index').using('hnsw', table.content_vector_1024.op('vector_cosine_ops')),
  index('chat_messages_content_vector_768_index').using('hnsw', table.content_vector_768.op('vector_cosine_ops')),
  index('jieba_tokens_index').using('gin', table.jieba_tokens.op('jsonb_path_ops')),
])

export const stickersTable = pgTable('stickers', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text().notNull().default(''),
  name: text().notNull().default(''),
  emoji: text().notNull().default(''),
  label: text().notNull().default(''),
  file_id: text().notNull().default(''),
  image_base64: text().notNull().default(''),
  image_path: text().notNull().default(''),
  description: text().notNull().default(''),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  description_vector_1536: vector({ dimensions: 1536 }),
  description_vector_1024: vector({ dimensions: 1024 }),
  description_vector_768: vector({ dimensions: 768 }),
}, table => [
  index('stickers_description_vector_1536_index').using('hnsw', table.description_vector_1536.op('vector_cosine_ops')),
  index('stickers_description_vector_1024_index').using('hnsw', table.description_vector_1024.op('vector_cosine_ops')),
  index('stickers_description_vector_768_index').using('hnsw', table.description_vector_768.op('vector_cosine_ops')),
])

export const stickerPacksTable = pgTable('sticker_packs', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text().notNull().default(''),
  platform_id: text().notNull().default(''),
  name: text().notNull().default(''),
  description: text().notNull().default(''),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
}, table => [
  uniqueIndex('sticker_packs_platform_platform_id_unique_index').on(table.platform, table.platform_id),
])

export const recentSentStickersTable = pgTable('recent_sent_stickers', {
  id: uuid().primaryKey().defaultRandom(),
  sticker_id: uuid().notNull().references(() => stickersTable.id, { onDelete: 'cascade' }),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
})

export const photosTable = pgTable('photos', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text().notNull().default(''),
  file_id: text().notNull().default(''),
  image_base64: text().notNull().default(''),
  image_path: text().notNull().default(''),
  caption: text().notNull().default(''),
  description: text().notNull().default(''),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  description_vector_1536: vector({ dimensions: 1536 }),
  description_vector_1024: vector({ dimensions: 1024 }),
  description_vector_768: vector({ dimensions: 768 }),
}, table => [
  index('photos_description_vector_1536_index').using('hnsw', table.description_vector_1536.op('vector_cosine_ops')),
  index('photos_description_vector_1024_index').using('hnsw', table.description_vector_1024.op('vector_cosine_ops')),
  index('photos_description_vector_768_index').using('hnsw', table.description_vector_768.op('vector_cosine_ops')),
])

export const joinedChatsTable = pgTable('joined_chats', () => {
  return {
    id: uuid().primaryKey().defaultRandom(),
    platform: text().notNull().default(''),
    chat_id: text().notNull().default('').unique(),
    chat_name: text().notNull().default(''),
    chat_type: text().notNull().default('user').$type<'user' | 'channel' | 'group'>(),
    created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
    updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  }
}, (table) => {
  return [
    {
      uniquePlatformChatId: uniqueIndex('platform_chat_id_unique_index').on(table.platform, table.chat_id),
    },
  ]
})

// export const chatMessageStatsView = pgView('chat_message_stats', {
//   platform: text().notNull(),
//   chat_id: text().notNull(),
//   chat_name: text().notNull(),
//   message_count: integer().notNull(),
//   latest_message_at: bigint({ mode: 'number' }),
// }).as((qb) => {
//   return qb
//     .select({
//       platform: joinedChatsTable.platform,
//       chat_id: joinedChatsTable.chat_id,
//       chat_name: joinedChatsTable.chat_name,
//       message_count: sql<number>`count(${chatMessagesTable.id})`.as('message_count'),
//       latest_message_at: sql<number>`max(${chatMessagesTable.created_at})`.as('latest_message_at'),
//     })
//     .from(joinedChatsTable)
//     .leftJoin(chatMessagesTable, sql`${joinedChatsTable.chat_id} = ${chatMessagesTable.in_chat_id}`)
//     .groupBy(joinedChatsTable.platform, joinedChatsTable.chat_id, joinedChatsTable.chat_name)
// })

export const chatMessageStatsView = pgView('chat_message_stats', {
  platform: text().notNull(),
  chat_id: text().notNull(),
  chat_name: text().notNull(),
  message_count: integer().notNull(),
  latest_message_at: bigint({ mode: 'number' }),
}).as(
  sql`
    SELECT 
      jc.platform, 
      jc.chat_id, 
      jc.chat_name, 
      COUNT(cm.id)::int AS message_count, 
      MAX(cm.created_at) AS latest_message_at
    FROM joined_chats jc
    LEFT JOIN chat_messages cm ON jc.chat_id = cm.in_chat_id
    GROUP BY jc.platform, jc.chat_id, jc.chat_name
  `,
)
