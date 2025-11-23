import { relations } from 'drizzle-orm'
import { bigint, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { accountJoinedChatsTable } from './account_joined_chats'

export const accountsTable = pgTable('accounts', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text().notNull().default('telegram'),
  platform_user_id: text().notNull().default(''),
  created_at: bigint({ mode: 'number' }).notNull().$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().$defaultFn(() => Date.now()),
}, table => [
  uniqueIndex('accounts_platform_platform_user_id_unique_index').on(table.platform, table.platform_user_id),
])

export const accountsRelations = relations(accountsTable, ({ many }) => ({
  accountJoinedChats: many(accountJoinedChatsTable),
}))
