import { bigint, index, integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const syncConfigItems = pgTable('sync_config_items', {
  id: serial('id').primaryKey(),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  syncType: varchar('sync_type', { length: 20 }).notNull(), // 'metadata' 或 'messages'
  status: varchar('status', { length: 20 }).notNull().default('idle'),
  priority: integer('priority').default(0),
  lastSyncTime: timestamp('last_sync_time'),
  lastMessageId: bigint('last_message_id', { mode: 'number' }),
  metadataVersion: integer('metadata_version'), // 用于追踪元数据版本
  lastError: text('last_error'),
  options: jsonb('options').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, table => ({
  chatTypeIdx: index('idx_sync_items_chat_type').on(table.chatId, table.syncType),
  statusIdx: index('idx_sync_config_items_status').on(table.status),
  priorityIdx: index('idx_sync_config_items_priority').on(table.priority),
}))

// 生成类型
export type SyncConfigItem = typeof syncConfigItems.$inferSelect
export type NewSyncConfigItem = typeof syncConfigItems.$inferInsert
