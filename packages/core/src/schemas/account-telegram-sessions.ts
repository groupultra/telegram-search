import { bigint, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { accountsTable } from './accounts'

/**
 * Telegram MTProto sessions that the server keeps so it can reconnect accounts
 * after a restart. Only the OAuth mode writes rows. `ciphertext` is
 * AES-256-GCM sealed with a key derived from the server secret and bound to
 * `account_id`; it holds the session string and the WebSocket session key,
 * both of which grant access to the account.
 */
export const accountTelegramSessionsTable = pgTable('account_telegram_sessions', {
  account_id: uuid().primaryKey().references(() => accountsTable.id, { onDelete: 'cascade' }),
  ciphertext: text().notNull(),
  updated_at: bigint({ mode: 'number' }).notNull().$defaultFn(() => Date.now()),
})
