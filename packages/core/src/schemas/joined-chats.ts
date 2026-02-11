// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/db/schema.ts

import { bigint, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export type JoinedChatType = 'user' | 'bot' | 'channel' | 'group' | 'supergroup'

export const joinedChatsTable = pgTable('joined_chats', () => {
  return {
    id: uuid().primaryKey().defaultRandom(),
    platform: text().notNull().default(''),
    chat_id: text().notNull().default('').unique(),
    chat_name: text().notNull().default(''),
    chat_type: text().notNull().default('user').$type<JoinedChatType>(),
    chat_username: text(), // Public username for channels/supergroups (nullable)
    note: text().notNull().default(''),
    dialog_date: bigint({ mode: 'number' }).notNull().default(0),
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
