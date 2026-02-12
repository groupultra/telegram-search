// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/db/schema.ts

import type { JoinedChatType } from './joined-chats'

import { bigint, boolean, index, jsonb, pgTable, text, unique, uuid, vector } from 'drizzle-orm/pg-core'

import { accountsTable } from './accounts'
import { usersTable } from './users'

// export type ChatMessageType = 'message' | 'edited_message' | 'channel_post' | 'edited_channel_post' | 'inline_query' | 'chosen_inline_result' | 'callback_query' | 'shipping_query' | 'pre_checkout_query' | 'poll' | 'poll_answer' | 'my_chat_member' | 'chat_member' | 'chat_join_request'

export const chatMessagesTable = pgTable('chat_messages', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text().notNull().default(''),
  platform_message_id: text().notNull().default(''),
  // message_type: text().$type<ChatMessageType>().notNull(),
  from_id: text().notNull().default(''),
  from_name: text().notNull().default(''),
  from_user_uuid: uuid().references(() => usersTable.id, { onDelete: 'set null' }),
  owner_account_id: uuid().references(() => accountsTable.id, { onDelete: 'cascade' }),
  in_chat_id: text().notNull().default(''),
  in_chat_type: text().$type<JoinedChatType>().notNull(),
  content: text().notNull().default(''),
  is_reply: boolean().notNull().default(false),
  reply_to_name: text().notNull().default(''),
  reply_to_id: text().notNull().default(''),
  platform_timestamp: bigint({ mode: 'number' }).notNull().default(0),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  deleted_at: bigint({ mode: 'number' }).notNull().default(0),
  content_vector_model: text().notNull().default(''),
  content_vector_1536: vector({ dimensions: 1536 }),
  content_vector_1024: vector({ dimensions: 1024 }),
  content_vector_768: vector({ dimensions: 768 }),
  jieba_tokens: jsonb().notNull().default([]),
}, table => [
  unique('chat_messages_platform_platform_message_id_in_chat_id_owner_account_id_unique_index')
    .on(table.platform, table.platform_message_id, table.in_chat_id, table.owner_account_id)
    .nullsNotDistinct(),
  index('chat_messages_content_vector_1536_index').using('hnsw', table.content_vector_1536.op('vector_cosine_ops')),
  index('chat_messages_content_vector_1024_index').using('hnsw', table.content_vector_1024.op('vector_cosine_ops')),
  index('chat_messages_content_vector_768_index').using('hnsw', table.content_vector_768.op('vector_cosine_ops')),
  index('jieba_tokens_index').using('gin', table.jieba_tokens.op('jsonb_path_ops')),
  index('chat_messages_from_user_uuid_index').on(table.from_user_uuid),
])
