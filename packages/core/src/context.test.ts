import { describe, expect, it } from 'vitest'

import { createCoreContext } from './context'

describe('coreContext account management', () => {
  it('should set and get current account id', () => {
    const ctx = createCoreContext()

    const ACCOUNT_ID = 'account-123'
    ctx.setCurrentAccountId(ACCOUNT_ID)

    const result = ctx.getCurrentAccountId()

    expect(result).toBe(ACCOUNT_ID)
  })

  it('should throw when getting current account id before it is set', () => {
    const ctx = createCoreContext()

    expect(() => {
      ctx.getCurrentAccountId()
    }).toThrowError()
  })
})
