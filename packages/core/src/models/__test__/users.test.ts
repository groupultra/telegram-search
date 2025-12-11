import type { CoreEntity } from '../../types/events'

import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { usersTable } from '../../schemas/users'
import { findUserByPlatformId, findUserByUUID, recordUser } from '../users'
import { convertCoreEntityToDBUser, convertDBUserToCoreEntity } from '../utils/users'

async function setupDb() {
  return mockDB({
    usersTable,
  })
}

describe('models/users', () => {
  it('recordUser inserts a new user', async () => {
    const db = await setupDb()

    const coreUser: CoreEntity = {
      type: 'user',
      id: '123',
      name: 'Alice',
      username: 'alice',
    }

    const result = await recordUser(db, coreUser)
    const user = result

    expect(user.platform).toBe('telegram')
    expect(user.platform_user_id).toBe('123')
    expect(user.name).toBe('Alice')
    expect(user.username).toBe('alice')
    expect(user.type).toBe('user')

    const rows = await db.select().from(usersTable)
    expect(rows).toHaveLength(1)
  })

  it('recordUser upserts and updates fields on conflict', async () => {
    const db = await setupDb()

    const coreUser: CoreEntity = {
      type: 'user',
      id: '123',
      name: 'Alice',
      username: 'alice',
    }

    const first = await recordUser(db, coreUser)

    const updatedUser: CoreEntity = {
      ...coreUser,
      name: 'Alice Updated',
      username: 'alice_new',
    }

    const second = await recordUser(db, updatedUser)

    expect(second.id).toBe(first.id)
    expect(second.name).toBe('Alice Updated')
    expect(second.username).toBe('alice_new')
  })

  it('findUserByPlatformId and findUserByUUID return the correct user', async () => {
    const db = await setupDb()

    const coreUser: CoreEntity = {
      type: 'user',
      id: '123',
      name: 'Alice',
      username: 'alice',
    }

    const created = await recordUser(db, coreUser)

    const byPlatform = (await findUserByPlatformId(db, 'telegram', '123')).unwrap()
    expect(byPlatform?.id).toBe(created.id)

    const byUuid = (await findUserByUUID(db, created.id)).unwrap()
    expect(byUuid?.id).toBe(created.id)
  })

  it('convertCoreEntityToDBUser maps CoreEntity to DBInsertUser correctly', () => {
    const userEntity: CoreEntity = {
      type: 'user',
      id: '1',
      name: 'User Name',
      username: 'username',
    }

    const chatEntity: CoreEntity = {
      type: 'chat',
      id: '2',
      name: 'Chat Name',
    }

    const channelEntity: CoreEntity = {
      type: 'channel',
      id: '3',
      name: 'Channel Name',
    }

    const userDb = convertCoreEntityToDBUser(userEntity)
    expect(userDb).toEqual({
      platform: 'telegram',
      platform_user_id: '1',
      name: 'User Name',
      username: 'username',
      type: 'user',
    })

    const chatDb = convertCoreEntityToDBUser(chatEntity)
    expect(chatDb).toEqual({
      platform: 'telegram',
      platform_user_id: '2',
      name: 'Chat Name',
      username: '2',
      type: 'chat',
    })

    const channelDb = convertCoreEntityToDBUser(channelEntity)
    expect(channelDb).toEqual({
      platform: 'telegram',
      platform_user_id: '3',
      name: 'Channel Name',
      username: '3',
      type: 'channel',
    })
  })

  it('convertDBUserToCoreEntity maps DBSelectUser back to CoreEntity variants', async () => {
    const db = await setupDb()

    const userEntity: CoreEntity = {
      type: 'user',
      id: '1',
      name: 'User Name',
      username: 'username',
    }

    const chatEntity: CoreEntity = {
      type: 'chat',
      id: '2',
      name: 'Chat Name',
    }

    const channelEntity: CoreEntity = {
      type: 'channel',
      id: '3',
      name: 'Channel Name',
    }

    const [userRow] = await db.insert(usersTable).values(convertCoreEntityToDBUser(userEntity)).returning()
    const [chatRow] = await db.insert(usersTable).values(convertCoreEntityToDBUser(chatEntity)).returning()
    const [channelRow] = await db.insert(usersTable).values(convertCoreEntityToDBUser(channelEntity)).returning()

    expect(convertDBUserToCoreEntity(userRow)).toEqual(userEntity)
    expect(convertDBUserToCoreEntity(chatRow)).toEqual(chatEntity)
    expect(convertDBUserToCoreEntity(channelRow)).toEqual(channelEntity)
  })
})
