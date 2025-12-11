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
export async function recordUser(db: CoreDB, user: CoreEntity): Promise<DBSelectUser> {
  const rows = await db
    .insert(usersTable)
    .values(convertCoreEntityToDBUser(user))
    .onConflictDoUpdate({
      target: [usersTable.platform, usersTable.platform_user_id],
      set: {
        name: sql`excluded.name`,
        username: sql`excluded.username`,
        type: sql`excluded.type`,
        updated_at: Date.now(),
      },
    })
    .returning()

  return must0(rows)
}

/**
 * Find a user by platform and platform_user_id
 */
export async function findUserByPlatformId(db: CoreDB, platform: string, platformUserId: string): PromiseResult<DBSelectUser> {
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
export async function findUserByUUID(db: CoreDB, uuid: string): PromiseResult<DBSelectUser> {
  return withResult(async () => {
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, uuid))
      .limit(1)
    return must0(rows)
  })
}
