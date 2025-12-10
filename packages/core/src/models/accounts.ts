import type { CoreDB } from '../db'

import { Ok } from '@unbird/result'
import { and, eq } from 'drizzle-orm'

import { accountsTable } from '../schemas/accounts'
import { must0 } from './utils/must'

export type DBInsertAccount = typeof accountsTable.$inferInsert
export type DBSelectAccount = typeof accountsTable.$inferSelect

/**
 * Record or update an account in the database
 */
export async function recordAccount(db: CoreDB, platform: string, platformUserId: string) {
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

  return Ok(must0(rows))
}

/**
 * Find an account by platform and platform_user_id
 */
export async function findAccountByPlatformId(db: CoreDB, platform: string, platformUserId: string) {
  const results = await db
    .select()
    .from(accountsTable)
    .where(and(
      eq(accountsTable.platform, platform),
      eq(accountsTable.platform_user_id, platformUserId),
    ))
    .limit(1)

  return Ok(must0(results))
}

/**
 * Find an account by UUID
 */
export async function findAccountByUUID(db: CoreDB, uuid: string) {
  const results = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, uuid))
    .limit(1)

  return Ok(must0(results))
}
