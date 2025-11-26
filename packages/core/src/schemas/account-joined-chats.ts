import { relations } from 'drizzle-orm'
import { bigint, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { accountsTable } from './accounts'
import { joinedChatsTable } from './joined-chats'

export const accountJoinedChatsTable = pgTable('account_joined_chats', {
  id: uuid().primaryKey().defaultRandom(),
  account_id: uuid().notNull().references(() => accountsTable.id, { onDelete: 'cascade' }),
  joined_chat_id: uuid().notNull().references(() => joinedChatsTable.id, { onDelete: 'cascade' }),
  created_at: bigint({ mode: 'number' }).notNull().$defaultFn(() => Date.now()),
}, table => [
  uniqueIndex('account_joined_chats_account_joined_chat_unique_index').on(table.account_id, table.joined_chat_id),
])

export const accountJoinedChatsRelations = relations(accountJoinedChatsTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [accountJoinedChatsTable.account_id],
    references: [accountsTable.id],
  }),
  joinedChat: one(joinedChatsTable, {
    fields: [accountJoinedChatsTable.joined_chat_id],
    references: [joinedChatsTable.id],
  }),
}))

export const accountsRelations = relations(accountsTable, ({ many }) => ({
  accountJoinedChats: many(accountJoinedChatsTable),
}))

export const joinedChatsRelations = relations(joinedChatsTable, ({ many }) => ({
  accountJoinedChats: many(accountJoinedChatsTable),
}))
