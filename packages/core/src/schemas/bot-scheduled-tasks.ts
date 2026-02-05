import { bigint, boolean, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { accountsTable } from './accounts'

export interface BotScheduledTaskConfig {
  chatIds?: string[]
  summaryMode?: 'daily' | 'last24h'
  language?: string
}

export const botScheduledTasksTable = pgTable('bot_scheduled_tasks', {
  id: uuid().primaryKey().defaultRandom(),
  account_id: uuid().notNull().references(() => accountsTable.id),
  task_type: text().notNull(),
  schedule: text().notNull(),
  config: jsonb().$type<BotScheduledTaskConfig>().default({}),
  enabled: boolean().notNull().default(true),
  last_run_at: bigint({ mode: 'number' }),
  created_at: bigint({ mode: 'number' }).notNull().$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().$defaultFn(() => Date.now()),
})
