import { and, eq } from 'drizzle-orm'

import { withDb } from '../db'
import { accountsTable } from '../schemas/accounts'

export type DBInsertAccount = typeof accountsTable.$inferInsert
export type DBSelectAccount = typeof accountsTable.$inferSelect

/**
 * Record or update an account in the database
 */
export async function recordAccount(platform: string, platformUserId: string) {
  const dbAccount: DBInsertAccount = {
    platform,
    platform_user_id: platformUserId,
  }

  return withDb(async db => db
    .insert(accountsTable)
    .values(dbAccount)
    .onConflictDoUpdate({
      target: [accountsTable.platform, accountsTable.platform_user_id],
      set: {
        updated_at: Date.now(),
      },
    })
    .returning(),
  )
}

/**
 * Find an account by platform and platform_user_id
 */
export async function findAccountByPlatformId(platform: string, platformUserId: string) {
  return withDb(async (db) => {
    const results = await db
      .select()
      .from(accountsTable)
      .where(and(
        eq(accountsTable.platform, platform),
        eq(accountsTable.platform_user_id, platformUserId),
      ))
      .limit(1)

    return results.length > 0 ? results[0] : null
  })
}

/**
 * Find an account by UUID
 */
export async function findAccountByUUID(uuid: string) {
  return withDb(async (db) => {
    const results = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.id, uuid))
      .limit(1)

    return results[0] || null
  })
}
