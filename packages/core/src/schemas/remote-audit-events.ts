import { bigint, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const remoteAuditEventsTable = pgTable('remote_audit_events', {
  id: uuid().primaryKey().defaultRandom(),
  request_id: text().notNull(),
  credential_id: uuid().notNull(),
  credential_name: text().notNull(),
  account_id: uuid().notNull(),
  method: text().notNull(),
  chat_ids: jsonb().$type<string[]>().notNull(),
  decision: text().$type<'allowed' | 'denied'>().notNull(),
  outcome: text().$type<'success' | 'failure'>().notNull(),
  error_code: text(),
  request_summary: jsonb().$type<Record<string, unknown>>().notNull(),
  result_summary: jsonb().$type<Record<string, unknown>>().notNull(),
  duration_ms: integer().notNull(),
  user_agent: text(),
  created_at: bigint({ mode: 'number' }).notNull().$defaultFn(() => Date.now()),
}, table => [
  index('remote_audit_events_created_at_index').on(table.created_at),
  index('remote_audit_events_credential_id_created_at_index').on(table.credential_id, table.created_at),
  index('remote_audit_events_account_id_created_at_index').on(table.account_id, table.created_at),
  index('remote_audit_events_request_id_index').on(table.request_id),
])
