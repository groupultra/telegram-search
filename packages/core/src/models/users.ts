import type { CoreDB } from '../db'
import type { CoreEntity } from '../types/events'
import type { PromiseResult } from '../utils/result'
import type { DBSelectUser } from './utils/types'

import { and, eq, sql } from 'drizzle-orm'

import { usersTable } from '../schemas/users'
import { withResult } from '../utils/result'
import { must0 } from './utils/must'
import { convertCoreEntityToDBUser } from './utils/users'

/**
 * Record or update a user in the database
 */
async function recordUser(db: CoreDB, user: CoreEntity): Promise<DBSelectUser> {
  const rows = await db
    .insert(usersTable)
    .values(convertCoreEntityToDBUser(user))
    .onConflictDoUpdate({
      target: [usersTable.platform, usersTable.platform_user_id],
      set: {
        name: sql`excluded.name`,
        username: sql`excluded.username`,
        type: sql`excluded.type`,
        access_hash: sql`excluded.access_hash`,
        updated_at: Date.now(),
      },
    })
    .returning()

  return must0(rows)
}

/**
 * Find a user by platform and platform_user_id
 */
async function findUserByPlatformId(db: CoreDB, platform: string, platformUserId: string): PromiseResult<DBSelectUser> {
  return withResult(async () => {
    const rows = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.platform, platform),
        eq(usersTable.platform_user_id, platformUserId),
      ))
      .limit(1)
    return must0(rows)
  })
}

/**
 * Find a user by UUID
 */
async function findUserByUUID(db: CoreDB, uuid: string): PromiseResult<DBSelectUser> {
  return withResult(async () => {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, uuid))
      .limit(1)
    return must0(rows)
  })
}

export const userModels = {
  recordUser,
  findUserByPlatformId,
  findUserByUUID,
  findUserAccessHash,
}

export type UserModels = typeof userModels

/**
 * Find user access hash by platform user id
 */
async function findUserAccessHash(db: CoreDB, platformUserId: string): PromiseResult<string | null> {
  return withResult(async () => {
    const rows = await db
      .select({ access_hash: usersTable.access_hash })
      .from(usersTable)
      .where(eq(usersTable.platform_user_id, platformUserId))
      .limit(1)

    if (rows.length === 0)
      return null
    return rows[0].access_hash || null
  })
}
