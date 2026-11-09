import { bigint, jsonb, pgTable, text } from 'drizzle-orm/pg-core'

/** Database-wide settings shared by every account, keyed by setting name. */
export const systemSettingsTable = pgTable('system_settings', {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  updated_at: bigint({ mode: 'number' }).notNull().$defaultFn(() => Date.now()).$onUpdateFn(() => Date.now()),
})
