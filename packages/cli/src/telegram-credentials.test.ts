import { BUILTIN_TELEGRAM_API_HASH, BUILTIN_TELEGRAM_API_ID } from '@tg-search/common'
import { describe, expect, it } from 'vitest'

import { resolveCliTelegramCredentials } from './telegram-credentials'

describe('resolveCliTelegramCredentials', () => {
  it('prefers a complete profile pair over the environment', () => {
    expect(resolveCliTelegramCredentials({ apiId: '1', apiHash: 'profile' }, { TELEGRAM_API_ID: '2', TELEGRAM_API_HASH: 'env' }))
      .toEqual({ apiId: '1', apiHash: 'profile', source: 'profile' })
  })

  it('uses a complete environment pair when the profile has none', () => {
    expect(resolveCliTelegramCredentials({}, { TELEGRAM_API_ID: '2', TELEGRAM_API_HASH: 'env' }))
      .toEqual({ apiId: '2', apiHash: 'env', source: 'environment' })
  })

  it('never mixes an ID and a hash from different sources', () => {
    // An API hash is only valid for the API ID it was issued with.
    expect(resolveCliTelegramCredentials({ apiId: '1' }, { TELEGRAM_API_HASH: 'env' }))
      .toEqual({ apiId: BUILTIN_TELEGRAM_API_ID, apiHash: BUILTIN_TELEGRAM_API_HASH, source: 'builtin' })
  })

  it('falls back to the built-in app for empty or blank values', () => {
    expect(resolveCliTelegramCredentials({ apiId: ' ', apiHash: '' }, { TELEGRAM_API_ID: '', TELEGRAM_API_HASH: 'env' }).source).toBe('builtin')
  })
})
