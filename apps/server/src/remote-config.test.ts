import { describe, expect, it } from 'vitest'

import { remoteAccessFromEnv } from './remote'

const access = { token: 'synthetic-token-'.repeat(4), accountId: '11111111-1111-4111-8111-111111111111' }
const policy = {
  credentials: [{
    id: '22222222-2222-4222-8222-222222222222',
    name: 'test-reader',
    token: access.token,
    accountId: access.accountId,
    capabilities: ['messages.get'],
    chatPermissions: [{ chatId: '42', permissions: ['read'] }],
  }],
}

describe('remote server configuration', () => {
  it('loads scoped credentials from the access policy', () => {
    const parsed = remoteAccessFromEnv({ TG_SEARCH_REMOTE_ACCESS: JSON.stringify(policy) })!
    expect(parsed.credentialsByTokenHash.size).toBe(1)
    expect([...parsed.credentialsByTokenHash.values()][0]).toMatchObject({
      accountId: access.accountId,
      capabilities: new Set(['messages.get']),
      readableChatIds: ['42'],
    })
  })

  it('does not enable the remote API from legacy server variables', () => {
    expect(remoteAccessFromEnv({ TG_SEARCH_REMOTE_TOKEN: access.token, TG_SEARCH_REMOTE_ACCOUNT_ID: access.accountId })).toBeUndefined()
  })

  it('leaves remote access disabled when no policy is supplied', () => {
    expect(remoteAccessFromEnv({})).toBeUndefined()
  })
})
