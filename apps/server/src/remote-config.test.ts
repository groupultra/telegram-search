import { describe, expect, it } from 'vitest'

import { remoteAccessFromEnv } from './remote'

const access = { token: 'synthetic-token-'.repeat(4), accountId: '11111111-1111-4111-8111-111111111111' }

describe('existing remote server configuration', () => {
  it('keeps the token and account configuration used by existing deployments', () => {
    // These CLI changes must not silently remove the existing remote route on upgrade.
    expect(remoteAccessFromEnv({ TG_SEARCH_REMOTE_TOKEN: access.token, TG_SEARCH_REMOTE_ACCOUNT_ID: access.accountId })).toEqual(access)
  })

  it('rejects an incomplete token/account pair instead of silently disabling access', () => {
    expect(() => remoteAccessFromEnv({ TG_SEARCH_REMOTE_TOKEN: access.token })).toThrow()
    expect(() => remoteAccessFromEnv({ TG_SEARCH_REMOTE_ACCOUNT_ID: access.accountId })).toThrow()
  })

  it('leaves remote access disabled when neither existing setting is supplied', () => {
    expect(remoteAccessFromEnv({})).toBeUndefined()
  })
})
