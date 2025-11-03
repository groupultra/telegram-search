import type { CoreEntity } from '../services/entity'

import { and, eq, sql } from 'drizzle-orm'

import { withDb } from '../db'
import { usersTable } from '../schemas/users'

export type DBInsertUser = typeof usersTable.$inferInsert
export type DBSelectUser = typeof usersTable.$inferSelect

/**
 * Record or update a user in the database
 */
export async function recordUser(user: CoreEntity) {
  const dbUser: DBInsertUser = {
    platform: 'telegram',
    platform_user_id: user.id,
    name: user.name,
    username: 'username' in user ? user.username : user.id,
    type: user.type,
  }

  return withDb(async db => db
    .insert(usersTable)
    .values(dbUser)
    .onConflictDoUpdate({
      target: [usersTable.platform, usersTable.platform_user_id],
      set: {
        name: sql`excluded.name`,
        username: sql`excluded.username`,
        type: sql`excluded.type`,
        updated_at: Date.now(),
      },
    })
    .returning(),
  )
}

/**
 * Find a user by platform and platform_user_id
 */
export async function findUserByPlatformId(platform: string, platformUserId: string) {
  return withDb(async (db) => {
    const results = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.platform, platform),
        eq(usersTable.platform_user_id, platformUserId),
      ))
      .limit(1)

    return results.length > 0 ? results[0] : null
  })
}

/**
 * Find a user by UUID
 */
export async function findUserByUUID(uuid: string) {
  return withDb(async (db) => {
    const results = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, uuid))
      .limit(1)

    return results[0] || null
  })
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
