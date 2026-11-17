import type { CoreDB } from '@tg-search/core'

import { Buffer } from 'node:buffer'

import { accountTelegramSessionsTable } from '@tg-search/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockDB } from '../../../../packages/core/src/db/mock'
import { accountsTable } from '../../../../packages/core/src/schemas/accounts'
import { createTelegramSessionStore } from './store'

const secret = 'synthetic-better-auth-secret-'.repeat(2)
const session = '1BAAOMTQ5LjE1NC4xNjcuNTAAUsynthetic-mtproto-session'
const runtimeKey = '4d8f2c4e-2b7a-4c1e-9a55-0d6f3c1b2a90'

function logger() {
  const warn = vi.fn()
  return { warn, value: { withFields: () => ({ withError: () => ({ warn }) }) } as never }
}

describe('createTelegramSessionStore', () => {
  let db: CoreDB
  let accountA: string
  let accountB: string

  beforeEach(async () => {
    db = await mockDB({ accountsTable, accountTelegramSessionsTable })
    const rows = await db.insert(accountsTable).values([{ platform_user_id: '1001' }, { platform_user_id: '1002' }]).returning()
    ;[accountA, accountB] = rows.map(row => row.id)
  })

  it('round-trips a session without storing it in plaintext', async () => {
    const store = createTelegramSessionStore({ db, secret, logger: logger().value })
    await store.save({ accountId: accountA, runtimeKey, session })

    const [row] = await db.select().from(accountTelegramSessionsTable)
    expect(row.ciphertext).not.toContain(session)
    expect(row.ciphertext).not.toContain(runtimeKey)
    expect(Buffer.from(row.ciphertext, 'base64url').toString('latin1')).not.toContain('mtproto')
    expect(await store.loadAll()).toEqual([{ accountId: accountA, runtimeKey, session }])
  })

  it('keeps one row per account and replaces it on a later login', async () => {
    const store = createTelegramSessionStore({ db, secret, logger: logger().value })
    await store.save({ accountId: accountA, runtimeKey, session })
    await store.save({ accountId: accountA, runtimeKey: 'other-browser', session: `${session}-2` })
    expect(await store.loadAll()).toEqual([{ accountId: accountA, runtimeKey: 'other-browser', session: `${session}-2` }])
  })

  it('skips a ciphertext moved onto another account', async () => {
    // The account ID is authenticated data: a database writer must not be able to hand account A's session to account B.
    const log = logger()
    const store = createTelegramSessionStore({ db, secret, logger: log.value })
    await store.save({ accountId: accountA, runtimeKey, session })
    const [row] = await db.select().from(accountTelegramSessionsTable)
    await db.delete(accountTelegramSessionsTable)
    await db.insert(accountTelegramSessionsTable).values({ account_id: accountB, ciphertext: row.ciphertext })

    expect(await store.loadAll()).toEqual([])
    expect(log.warn).toHaveBeenCalledOnce()
    // Kept, so restoring the old secret or the next login can still use the row.
    expect(await db.select().from(accountTelegramSessionsTable)).toHaveLength(1)
  })

  it('skips rows sealed with another secret or corrupted', async () => {
    await createTelegramSessionStore({ db, secret: 'another-synthetic-secret-'.repeat(2), logger: logger().value })
      .save({ accountId: accountA, runtimeKey, session })
    await db.insert(accountTelegramSessionsTable).values({ account_id: accountB, ciphertext: 'not-a-ciphertext' })

    const log = logger()
    expect(await createTelegramSessionStore({ db, secret, logger: log.value }).loadAll()).toEqual([])
    expect(log.warn).toHaveBeenCalledTimes(2)
  })

  it('removes a session and cascades with its account', async () => {
    const store = createTelegramSessionStore({ db, secret, logger: logger().value })
    await store.save({ accountId: accountA, runtimeKey, session })
    await store.save({ accountId: accountB, runtimeKey, session })
    await store.remove(accountA)
    expect((await store.loadAll()).map(entry => entry.accountId)).toEqual([accountB])
    await db.delete(accountsTable)
    expect(await db.select().from(accountTelegramSessionsTable)).toEqual([])
  })
})
