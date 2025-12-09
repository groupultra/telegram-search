import type { CoreDB } from '../db'

import { Err, Ok } from '@unbird/result'
import { and, eq } from 'drizzle-orm'

import { accountsTable } from '../schemas/accounts'

export type DBInsertAccount = typeof accountsTable.$inferInsert
export type DBSelectAccount = typeof accountsTable.$inferSelect

function toErr(error: unknown) {
  if (error instanceof Error) {
    return Err(error.cause ?? error)
  }

  return Err(error)
}

/**
 * Record or update an account in the database
 */
export async function recordAccount(db: CoreDB, platform: string, platformUserId: string) {
  const dbAccount: DBInsertAccount = {
    platform,
    platform_user_id: platformUserId,
  }

  try {
    const rows = await db
      .insert(accountsTable)
      .values(dbAccount)
      .onConflictDoUpdate({
        target: [accountsTable.platform, accountsTable.platform_user_id],
        set: {
          updated_at: Date.now(),
        },
      })
      .returning()

    return Ok(rows)
  }
  catch (error) {
    return toErr(error)
  }
}

/**
 * Find an account by platform and platform_user_id
 */
export async function findAccountByPlatformId(db: CoreDB, platform: string, platformUserId: string) {
  try {
    const results = await db
      .select()
      .from(accountsTable)
      .where(and(
        eq(accountsTable.platform, platform),
        eq(accountsTable.platform_user_id, platformUserId),
      ))
      .limit(1)

    return Ok(results.length > 0 ? results[0] : null)
  }
  catch (error) {
    return toErr(error)
  }
}

/**
 * Find an account by UUID
 */
export async function findAccountByUUID(db: CoreDB, uuid: string) {
  try {
    const results = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, uuid))
      .limit(1)

    return Ok(results[0] || null)
  }
  catch (error) {
    return toErr(error)
  }
}
