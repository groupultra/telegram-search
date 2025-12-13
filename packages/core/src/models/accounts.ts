import type { CoreDB } from '../db'
import type { PromiseResult } from '../utils/result'
import type { DBSelectAccount } from './utils/types'

import { and, eq } from 'drizzle-orm'

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

export const accountModels = {
  recordAccount,
  findAccountByPlatformId,
  findAccountByUUID,
}

export type AccountModels = typeof accountModels
