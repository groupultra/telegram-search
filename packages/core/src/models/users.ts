import type { CoreDB } from '../db'
import type { CoreEntity } from '../types/events'

import { Ok } from '@unbird/result'
import { and, eq, sql } from 'drizzle-orm'

import { usersTable } from '../schemas/users'
import { must0 } from './utils/must'

export type DBInsertUser = typeof usersTable.$inferInsert
export type DBSelectUser = typeof usersTable.$inferSelect

/**
 * Record or update a user in the database
 */
export async function recordUser(db: CoreDB, user: CoreEntity) {

  const rows = await db
    .insert(usersTable)
    .values({
      platform: 'telegram',
      platform_user_id: user.id,
      name: user.name,
      username: 'username' in user ? user.username : user.id,
      type: user.type,
    })
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

  return Ok(must0(rows))
}

/**
 * Find a user by platform and platform_user_id
 */
export async function findUserByPlatformId(db: CoreDB, platform: string, platformUserId: string) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(and(
      eq(usersTable.platform, platform),
      eq(usersTable.platform_user_id, platformUserId),
    ))
    .limit(1)

  return Ok(must0(rows))
}

/**
 * Find a user by UUID
 */
export async function findUserByUUID(db: CoreDB, uuid: string) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, uuid))
    .limit(1)

  return Ok(must0(rows))
}

/**
 * Convert CoreEntity to a format suitable for database insertion
 */
export function convertCoreEntityToDBUser(entity: CoreEntity): DBInsertUser {
  return {
    platform: 'telegram',
    platform_user_id: entity.id,
    name: entity.name,
    username: 'username' in entity ? entity.username : entity.id,
    type: entity.type,
  }
}

/**
 * Convert DBSelectUser back to CoreEntity
 */
export function convertDBUserToCoreEntity(dbUser: DBSelectUser): CoreEntity {
  if (dbUser.type === 'user') {
    return {
      type: 'user',
      id: dbUser.platform_user_id,
      name: dbUser.name,
      username: dbUser.username,
    }
  }
  else if (dbUser.type === 'chat') {
    return {
      type: 'chat',
      id: dbUser.platform_user_id,
      name: dbUser.name,
    }
  }
  else {
    return {
      type: 'channel',
      id: dbUser.platform_user_id,
      name: dbUser.name,
    }
  }
}
