import { relations } from 'drizzle-orm'
import { bigint, boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { accountsTable } from './accounts'

export const accountChatFoldersTable = pgTable('account_chat_folders', {
  id: uuid().primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accountsTable.id, { onDelete: 'cascade' }),
  folderId: integer('folder_id').notNull(), // Telegram folder ID
  title: text('title').notNull(),
  emoticon: text('emoticon'),
  pinnedChatIds: bigint('pinned_chat_ids', { mode: 'number' }).array().default([]),
  includedChatIds: bigint('included_chat_ids', { mode: 'number' }).array().default([]),
  excludedChatIds: bigint('excluded_chat_ids', { mode: 'number' }).array().default([]),
  contacts: boolean('contacts').default(false),
  nonContacts: boolean('non_contacts').default(false),
  groups: boolean('groups').default(false),
  broadcasts: boolean('broadcasts').default(false),
  bots: boolean('bots').default(false),
  excludeMuted: boolean('exclude_muted').default(false),
  excludeRead: boolean('exclude_read').default(false),
  excludeArchived: boolean('exclude_archived').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => [
  uniqueIndex('account_chat_folders_account_folder_unique').on(table.accountId, table.folderId),
])

export const accountChatFoldersRelations = relations(accountChatFoldersTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [accountChatFoldersTable.accountId],
    references: [accountsTable.id],
  }),
}))

export type DBInsertAccountChatFolder = typeof accountChatFoldersTable.$inferInsert
export type DBSelectAccountChatFolder = typeof accountChatFoldersTable.$inferSelect
