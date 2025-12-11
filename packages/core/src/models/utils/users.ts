import type { CoreEntity } from '../../types'
import type { DBInsertUser, DBSelectUser } from './types'

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
