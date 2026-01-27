import type { CoreContext, CoreEmitter } from '../../context'
import type { CoreUserEntity, FromCoreEvent, ToCoreEvent } from '../../types/events'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { eq } from 'drizzle-orm'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import { accountsTable } from '../../schemas/accounts'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { usersTable } from '../../schemas/users'
import { createEntityService } from '../entity'

const logger = useLogger()

async function setupDb() {
  return mockDB({
    accountsTable,
    joinedChatsTable,
    accountJoinedChatsTable,
    usersTable,
  })
}

const VALID_UUID = '11111111-1111-1111-1111-111111111111'

function createMockCtx(db: any, client: any, accountId?: string) {
  const withError = vi.fn((error: unknown) => (error instanceof Error ? error : new Error(String(error))))

  const ctx: CoreContext = {
    emitter: { emit: vi.fn(), on: vi.fn() } as unknown as CoreEmitter,
    toCoreEvents: new Set<keyof ToCoreEvent>(),
    fromCoreEvents: new Set<keyof FromCoreEvent>(),
    wrapEmitterEmit: () => {},
    wrapEmitterOn: () => {},
    setClient: () => {},
    getClient: () => client,
    setCurrentAccountId: () => {},
    getCurrentAccountId: () => accountId || '',
    getDB: () => db,
    withError,
    cleanup: () => {},
    setMyUser: () => {},
    getMyUser: () => ({}) as unknown as CoreUserEntity,
    getAccountSettings: async () => ({}) as unknown as any,
    setAccountSettings: async () => {},
    metrics: undefined,
  }

  return { ctx, withError }
}

describe('services/entity', () => {
  it('getInputPeer returns InputPeerSelf for "me" or "self"', async () => {
    const db = await setupDb()
    const client = {}
    const { ctx } = createMockCtx(db, client)
    const service = createEntityService(ctx, logger)

    expect(await service.getInputPeer('me')).toBeInstanceOf(Api.InputPeerSelf)
    expect(await service.getInputPeer('self')).toBeInstanceOf(Api.InputPeerSelf)
  })

  it('getInputPeer prioritizes DB Dialogs (account joined chats)', async () => {
    const db = await setupDb()
    const accountId = VALID_UUID

    // Setup DB state
    await db.insert(accountsTable).values({
      id: accountId,
      platform: 'telegram',
      platform_user_id: 'u1',
    })

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: '1001',
      chat_name: 'Channel',
      chat_type: 'channel',
    }).returning()

    await db.insert(accountJoinedChatsTable).values({
      account_id: accountId,
      joined_chat_id: chat.id,
      access_hash: '123456789',
    })

    // Verify DB
    const [link] = await db.select().from(accountJoinedChatsTable).where(eq(accountJoinedChatsTable.account_id, accountId))
    expect(link).toBeDefined()
    expect(link.access_hash).toBe('123456789')

    const client = {
      getInputEntity: vi.fn(),
    }
    const { ctx } = createMockCtx(db, client, accountId)
    const service = createEntityService(ctx, logger)

    const inputPeer = await service.getInputPeer('1001')

    expect(inputPeer).toBeInstanceOf(Api.InputPeerChannel)
    const channelPeer = inputPeer as Api.InputPeerChannel
    expect(channelPeer.channelId.toString()).toBe('1001')
    expect(channelPeer.accessHash.toString()).toBe('123456789')
    expect(client.getInputEntity).not.toHaveBeenCalled()
  })

  it('getInputPeer falls back to DB Users (global cache)', async () => {
    const db = await setupDb()
    const accountId = VALID_UUID

    // Setup DB state - User exists but NOT in account joined chats
    await db.insert(usersTable).values({
      platform: 'telegram',
      platform_user_id: '2002',
      name: 'User 2',
      username: 'user2',
      type: 'user',
      access_hash: '987654321',
    })

    // Verify DB insert worked
    const [user] = await db.select().from(usersTable).where(eq(usersTable.platform_user_id, '2002'))
    expect(user).toBeDefined()
    expect(user.access_hash).toBe('987654321')

    // Mock client to return something else if called (to verify it's NOT called if DB hit works,
    // or to verify fallback if DB hit fails)
    const client = {
      getInputEntity: vi.fn(async () => new Api.InputPeerUser({ userId: bigInt(0), accessHash: bigInt(0) })),
    }
    const { ctx } = createMockCtx(db, client, accountId)
    const service = createEntityService(ctx, logger)

    const inputPeer = await service.getInputPeer('2002')

    // If DB works, we expect InputPeerUser from DB
    expect(inputPeer).toBeInstanceOf(Api.InputPeerUser)
    const userPeer = inputPeer as Api.InputPeerUser
    expect(userPeer.userId.toString()).toBe('2002')
    expect(userPeer.accessHash.toString()).toBe('987654321')

    // Ensure client was NOT called
    expect(client.getInputEntity).not.toHaveBeenCalled()
  })

  it('getInputPeer falls back to Client if not in DB', async () => {
    const db = await setupDb()
    const accountId = VALID_UUID

    const client = {
      getInputEntity: vi.fn(async id => new Api.InputPeerUser({ userId: bigInt(id), accessHash: bigInt(0) })),
    }
    const { ctx } = createMockCtx(db, client, accountId)
    const service = createEntityService(ctx, logger)

    const inputPeer = await service.getInputPeer('3003')

    expect(client.getInputEntity).toHaveBeenCalledWith('3003')
    expect(inputPeer).toBeInstanceOf(Api.InputPeerUser)
    expect((inputPeer as Api.InputPeerUser).userId.toString()).toBe('3003')
  })

  it('processEntities saves users and chats with accessHash to DB', async () => {
    const db = await setupDb()
    const accountId = VALID_UUID

    // Create account to satisfy FK
    await db.insert(accountsTable).values({
      id: accountId,
      platform: 'telegram',
      platform_user_id: 'u1',
    })

    const client = {}
    const { ctx } = createMockCtx(db, client, accountId)
    const service = createEntityService(ctx, logger)

    const telegramUser = new Api.User({
      id: bigInt(4004),
      firstName: 'Test',
      accessHash: bigInt('11223344'),
      username: 'test_user',
    })

    const telegramChannel = new Api.Channel({
      id: bigInt(5005),
      title: 'Test Channel',
      accessHash: bigInt('55667788'),
      megagroup: true,
      photo: new Api.ChatPhoto({ photoId: bigInt(6006), dcId: 7 }),
      date: 1715443200,
    })

    await service.processEntities([telegramUser], [telegramChannel])

    // Verify User
    const [user] = await db.select().from(usersTable).where(eq(usersTable.platform_user_id, '4004'))
    expect(user).toBeDefined()
    expect(user.username).toBe('test_user')
    expect(user.access_hash).toBe('11223344')

    // Verify Chat
    const [chat] = await db.select().from(joinedChatsTable).where(eq(joinedChatsTable.chat_id, '5005'))
    expect(chat).toBeDefined()
    expect(chat.chat_name).toBe('Test Channel')
    // Access hash is now in accountJoinedChatsTable
    // expect(chat.access_hash).toBe('55667788')
    expect(chat.chat_type).toBe('channel')

    const [link] = await db.select().from(accountJoinedChatsTable).where(eq(accountJoinedChatsTable.joined_chat_id, chat.id))
    expect(link).toBeDefined()
    expect(link?.access_hash).toBe('55667788')
  })
})
