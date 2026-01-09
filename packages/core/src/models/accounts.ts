import type { CoreDB } from '../db'
import type { PromiseResult } from '../utils/result'
import type { DBSelectAccount } from './utils/types'

import { and, eq, sql } from 'drizzle-orm'

import { accountsTable } from '../schemas/accounts'
import { withResult } from '../utils/result'
import { must0 } from './utils/must'

/**
 * Record or update an account in the database
 */
async function recordAccount(db: CoreDB, platform: string, platformUserId: string): Promise<DBSelectAccount> {
  const rows = await db
    .insert(accountsTable)
    .values({
      platform,
      platform_user_id: platformUserId,
    })
    .onConflictDoUpdate({
      target: [accountsTable.platform, accountsTable.platform_user_id],
      set: {
        updated_at: Date.now(),
      },
    })
    .returning()

  return must0(rows)
}

/**
 * Find an account by platform and platform_user_id
 */
async function findAccountByPlatformId(db: CoreDB, platform: string, platformUserId: string): PromiseResult<DBSelectAccount> {
  return withResult(async () => {
    const rows = await db
      .select()
      .from(accountsTable)
      .where(and(
        eq(accountsTable.platform, platform),
        eq(accountsTable.platform_user_id, platformUserId),
      ))
      .limit(1)
    return must0(rows)
  })
}

/**
 * Find an account by UUID
 */
async function findAccountByUUID(db: CoreDB, uuid: string): PromiseResult<DBSelectAccount> {
  return withResult(async () => {
    const rows = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, uuid))
      .limit(1)

    return must0(rows)
  })
}

/**
 * Update the sync state for an account.
 * Fields pts, qts, seq, and date are updated using GREATEST() to ensure
 * they only move forward.
 */
export interface AccountStateUpdate {
  pts?: number
  qts?: number
  seq?: number
  date?: number
  lastSyncAt?: number
}

async function updateAccountState(
  db: CoreDB,
  accountId: string,
  state: AccountStateUpdate,
): PromiseResult<DBSelectAccount> {
  return withResult(async () => {
    const updateSet: Partial<Record<keyof DBSelectAccount, any>> = {
      updated_at: Date.now(),
    }

    if (state.lastSyncAt !== undefined) {
      updateSet.last_sync_at = state.lastSyncAt
    }

    const fields = ['pts', 'qts', 'seq', 'date'] as const
    for (const field of fields) {
      if (state[field] !== undefined) {
        updateSet[field] = sql`GREATEST(${accountsTable[field]}, ${state[field]})`
      }
    }

    const rows = await db
      .update(accountsTable)
      .set(updateSet)
      .where(eq(accountsTable.id, accountId))
      .returning()
    return must0(rows)
  })
}

/**
 * Force update the sync state for an account without monotonic checks.
 * Used for resets or specific bootstrapping scenarios.
 */
async function forceUpdateAccountState(
  db: CoreDB,
  accountId: string,
  state: AccountStateUpdate,
): PromiseResult<DBSelectAccount> {
  return withResult(async () => {
    const rows = await db
      .update(accountsTable)
      .set({
        ...state,
        last_sync_at: state.lastSyncAt,
        updated_at: Date.now(),
      })
      .where(eq(accountsTable.id, accountId))
      .returning()
    return must0(rows)
  })
}

export const accountModels = {
  recordAccount,
  findAccountByPlatformId,
  findAccountByUUID,
  updateAccountState,
  forceUpdateAccountState,
}

export type AccountModels = typeof accountModels
