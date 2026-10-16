import { useLogger } from '@guiiai/logg'
import { describe, expect, it } from 'vitest'

import { getMockEmptyDB } from '../mock'
import { createCoreContext } from './context'
import { models } from './models'
import { CoreEventType } from './types/events'

describe('coreContext account management', () => {
  it('should set and get current account id', () => {
    const ctx = createCoreContext(getMockEmptyDB, {} as any, useLogger())

    const ACCOUNT_ID = 'account-123'
    ctx.setCurrentAccountId(ACCOUNT_ID)

    const result = ctx.getCurrentAccountId()

    expect(result).toBe(ACCOUNT_ID)
  })

  it('should throw when getting current account id before it is set', () => {
    const ctx = createCoreContext(getMockEmptyDB, {} as any, useLogger())

    expect(() => {
      ctx.getCurrentAccountId()
    }).toThrowError()
  })
})

it('preserves classified error metadata when unwrapping a nested error', () => {
  const context = createCoreContext(getMockEmptyDB, models, useLogger())
  const errors: unknown[] = []
  context.emitter.on(CoreEventType.CoreError, error => errors.push(error))
  const cause = new Error('historical gap')
  try {
    expect(context.withError(new Error('wrapper', { cause }), 'Background history failed', { code: 'SYNC_CATCH_UP_FAILED' })).toBe(cause)
    expect(errors).toEqual([{ error: 'historical gap', description: 'Background history failed', code: 'SYNC_CATCH_UP_FAILED' }])
  }
  finally {
    context.cleanup()
  }
})
