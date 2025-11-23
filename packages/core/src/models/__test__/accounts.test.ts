import { beforeEach, describe, expect, it } from 'vitest'

import { setDbInstanceForTests } from '../../db'
import { mockDB } from '../../db/mock'
import { accountsTable } from '../../schemas/accounts'
import { findAccountByPlatformId, findAccountByUUID, recordAccount } from '../accounts'

describe('accounts model', () => {
  beforeEach(async () => {
    const db = await mockDB({ accountsTable })
    setDbInstanceForTests(db)
  })

  it('recordAccount should insert account with correct values', async () => {
    const result = await recordAccount('telegram', 'user-123')
    const rows = result.unwrap()

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      platform: 'telegram',
      platform_user_id: 'user-123',
    })
  })

  it('findAccountByPlatformId should query by platform and platform_user_id and return first result or null', async () => {
    const inserted = await recordAccount('telegram', 'user-xyz')
    const [account] = inserted.unwrap()

    const result = await findAccountByPlatformId('telegram', 'user-xyz')
    const found = result.unwrap()

    expect(found).not.toBeNull()
    expect(found?.id).toBe(account.id)
    expect(found?.platform).toBe('telegram')
    expect(found?.platform_user_id).toBe('user-xyz')
  })

  it('findAccountByUUID should query by id and return first result or null', async () => {
    const inserted = await recordAccount('telegram', 'user-abc')
    const [account] = inserted.unwrap()

    const result = await findAccountByUUID(account.id)
    const found = result.unwrap()

    expect(found).not.toBeNull()
    expect(found?.id).toBe(account.id)
    expect(found?.platform).toBe('telegram')
    expect(found?.platform_user_id).toBe('user-abc')
  })
})
