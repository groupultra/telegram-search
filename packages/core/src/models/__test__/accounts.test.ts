import type { CoreDB } from '../../db'

import { beforeEach, describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountsTable } from '../../schemas/accounts'
import { findAccountByPlatformId, findAccountByUUID, recordAccount } from '../accounts'

describe('accounts model', () => {
  let db: CoreDB

  beforeEach(async () => {
    db = await mockDB({ accountsTable })
  })

  it('recordAccount should insert account with correct values', async () => {
    const result = await recordAccount(db, 'telegram', 'user-123')
    const account = result.unwrap()

    expect(account).toMatchObject({
      platform: 'telegram',
      platform_user_id: 'user-123',
    })
  })

  it('findAccountByPlatformId should query by platform and platform_user_id and return first result or null', async () => {
    const inserted = await recordAccount(db, 'telegram', 'user-xyz')
    const account = inserted.unwrap()

    const result = await findAccountByPlatformId(db, 'telegram', 'user-xyz')
    const found = result.unwrap()

    expect(found).toBeDefined()
    expect(found.id).toBe(account.id)
    expect(found.platform).toBe('telegram')
    expect(found.platform_user_id).toBe('user-xyz')
  })

  it('findAccountByUUID should query by id and return first result or null', async () => {
    const inserted = await recordAccount(db, 'telegram', 'user-abc')
    const account = inserted.unwrap()

    const result = await findAccountByUUID(db, account.id)
    const found = result.unwrap()

    expect(found).toBeDefined()
    expect(found.id).toBe(account.id)
    expect(found.platform).toBe('telegram')
    expect(found.platform_user_id).toBe('user-abc')
  })
})
