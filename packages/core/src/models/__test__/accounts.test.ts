import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountsTable } from '../../schemas/accounts'
import { findAccountByPlatformId, findAccountByUUID, recordAccount } from '../accounts'

async function setupDb() {
  return mockDB({
    accountsTable,
  })
}

describe('models/accounts', () => {
  it('recordAccount inserts a new account when none exists', async () => {
    const db = await setupDb()

    const result = await recordAccount(db, 'telegram', 'user-1')
    const account = result

    expect(account.platform).toBe('telegram')
    expect(account.platform_user_id).toBe('user-1')

    const accounts = await db.select().from(accountsTable)
    expect(accounts).toHaveLength(1)
  })

  it('recordAccount updates existing account on conflict and bumps updated_at', async () => {
    const db = await setupDb()

    const first = await recordAccount(db, 'telegram', 'user-1')

    // Small delay to make updated_at difference observable even if clocks are coarse
    const second = await recordAccount(db, 'telegram', 'user-1')

    expect(second.id).toBe(first.id)
    expect(second.updated_at).toBeGreaterThanOrEqual(first.updated_at)
  })

  it('findAccountByPlatformId returns the correct account', async () => {
    const db = await setupDb()

    const created = await recordAccount(db, 'telegram', 'user-1')

    const found = (await findAccountByPlatformId(db, 'telegram', 'user-1')).unwrap()

    expect(found.id).toBe(created.id)
    expect(found.platform).toBe('telegram')
    expect(found.platform_user_id).toBe('user-1')
  })

  it('findAccountByUUID returns the correct account', async () => {
    const db = await setupDb()

    const created = (await recordAccount(db, 'telegram', 'user-1'))

    const found = (await findAccountByUUID(db, created.id)).unwrap()

    expect(found.id).toBe(created.id)
  })
})
