import { describe, expect, it } from 'vitest'

import { BUILTIN_TELEGRAM_API_HASH, BUILTIN_TELEGRAM_API_ID, resolveTelegramCredentials } from '../telegram-credentials'

describe('resolveTelegramCredentials', () => {
  it('returns the first complete pair in candidate order', () => {
    expect(resolveTelegramCredentials([
      { apiId: '1', apiHash: 'first', source: 'config' },
      { apiId: '2', apiHash: 'second', source: 'environment' },
    ])).toEqual({ apiId: '1', apiHash: 'first', source: 'config' })
  })

  it('skips incomplete pairs instead of combining their fields', () => {
    // An API hash is only valid for the API ID it was issued with.
    expect(resolveTelegramCredentials([
      { apiId: '1', source: 'config' },
      { apiHash: 'orphan', source: 'environment' },
      { apiId: '3', apiHash: 'third', source: 'fallback' },
    ])).toEqual({ apiId: '3', apiHash: 'third', source: 'fallback' })
  })

  it('falls back to the built-in app when no candidate is complete', () => {
    expect(resolveTelegramCredentials([{ apiId: ' ', apiHash: '', source: 'config' }]))
      .toEqual({ apiId: BUILTIN_TELEGRAM_API_ID, apiHash: BUILTIN_TELEGRAM_API_HASH, source: 'builtin' })
    expect(resolveTelegramCredentials([]).source).toBe('builtin')
  })
})
