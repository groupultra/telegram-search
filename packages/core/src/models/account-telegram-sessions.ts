import type { CoreDB } from '../db'
import type { PromiseResult } from '../utils/result'

import { eq } from 'drizzle-orm'

import { accountTelegramSessionsTable } from '../schemas/account-telegram-sessions'
import { withResult } from '../utils/result'

/** Rows hold ciphertext only; the server seals and opens it (see apps/server/src/sessions/store.ts). */
export interface AccountTelegramSessionRow {
  accountId: string
  ciphertext: string
}

async function upsertSession(db: CoreDB, row: AccountTelegramSessionRow): PromiseResult<void> {
  return withResult(async () => {
    const updatedAt = Date.now()
    await db
      .insert(accountTelegramSessionsTable)
      .values({ account_id: row.accountId, ciphertext: row.ciphertext, updated_at: updatedAt })
      .onConflictDoUpdate({ target: accountTelegramSessionsTable.account_id, set: { ciphertext: row.ciphertext, updated_at: updatedAt } })
  })
}

async function deleteSession(db: CoreDB, accountId: string): PromiseResult<void> {
  return withResult(async () => {
    await db.delete(accountTelegramSessionsTable).where(eq(accountTelegramSessionsTable.account_id, accountId))
  })
}

async function listSessions(db: CoreDB): PromiseResult<AccountTelegramSessionRow[]> {
  return withResult(async () => {
    const rows = await db
      .select({ accountId: accountTelegramSessionsTable.account_id, ciphertext: accountTelegramSessionsTable.ciphertext })
      .from(accountTelegramSessionsTable)
    return rows
  })
}

export const accountTelegramSessionModels = {
  upsertSession,
  deleteSession,
  listSessions,
}

export type AccountTelegramSessionModels = typeof accountTelegramSessionModels
