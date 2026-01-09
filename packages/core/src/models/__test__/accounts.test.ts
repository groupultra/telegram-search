import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountsTable } from '../../schemas/accounts'
import { accountModels } from '../accounts'

async function setupDb() {
  return mockDB({
    accountsTable,
  })
}

describe('models/accounts', () => {
  it('recordAccount inserts a new account when none exists', async () => {
    const db = await setupDb()

    const result = await accountModels.recordAccount(db, 'telegram', 'user-1')

    expect(result.platform).toBe('telegram')
    expect(result.platform_user_id).toBe('user-1')

    const accounts = await db.select().from(accountsTable)
    expect(accounts).toHaveLength(1)
  })

  it('recordAccount updates existing account on conflict and bumps updated_at', async () => {
    const db = await setupDb()

    const first = await accountModels.recordAccount(db, 'telegram', 'user-1')

    // Small delay to make updated_at difference observable even if clocks are coarse
    const second = await accountModels.recordAccount(db, 'telegram', 'user-1')

    expect(second.id).toBe(first.id)
    expect(second.updated_at).toBeGreaterThanOrEqual(first.updated_at)
  })

  it('findAccountByPlatformId returns the correct account', async () => {
    const db = await setupDb()

    const created = await accountModels.recordAccount(db, 'telegram', 'user-1')

    const found = (await accountModels.findAccountByPlatformId(db, 'telegram', 'user-1')).unwrap()

    expect(found.id).toBe(created.id)
    expect(found.platform).toBe('telegram')
    expect(found.platform_user_id).toBe('user-1')
  })

  it('findAccountByUUID returns the correct account', async () => {
    const db = await setupDb()

    const created = (await accountModels.recordAccount(db, 'telegram', 'user-1'))

    const found = (await accountModels.findAccountByUUID(db, created.id)).unwrap()

    expect(found.id).toBe(created.id)
  })

  it('updateAccountState updates pts and bumps updated_at using GREATEST', async () => {
    const db = await setupDb()

    const account = await accountModels.recordAccount(db, 'telegram', 'user-1')

    // Initial update
    await accountModels.updateAccountState(db, account.id, { pts: 100, date: 500 })
    let found = (await accountModels.findAccountByUUID(db, account.id)).unwrap()
    expect(found.pts).toBe(100)
    expect(found.date).toBe(500)

    // Update with larger values
    await accountModels.updateAccountState(db, account.id, { pts: 200, date: 600 })
    found = (await accountModels.findAccountByUUID(db, account.id)).unwrap()
    expect(found.pts).toBe(200)
    expect(found.date).toBe(600)

    // Update with smaller values
    await accountModels.updateAccountState(db, account.id, { pts: 150, date: 550 })
    found = (await accountModels.findAccountByUUID(db, account.id)).unwrap()
    expect(found.pts).toBe(200) // Stays at 200
    expect(found.date).toBe(600) // Stays at 600
  })

  it('forceUpdateAccountState updates state without GREATEST', async () => {
    const db = await setupDb()

    const account = await accountModels.recordAccount(db, 'telegram', 'user-1')

    await accountModels.updateAccountState(db, account.id, { pts: 100 })
    await accountModels.forceUpdateAccountState(db, account.id, { pts: 50 })

    const found = (await accountModels.findAccountByUUID(db, account.id)).unwrap()
    expect(found.pts).toBe(50)
  })
})
