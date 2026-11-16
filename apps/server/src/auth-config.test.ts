import { describe, expect, it } from 'vitest'

import { authConfigFromEnv } from './auth-config'

const oauthEnv = {
  TGS_AUTH: 'oauth',
  TGS_PUBLIC_URL: 'https://tgs.example.com/',
  BETTER_AUTH_SECRET: 'synthetic-secret-'.repeat(3),
  TELEGRAM_LOGIN_CLIENT_ID: '123456789',
  TELEGRAM_LOGIN_CLIENT_SECRET: 'synthetic-client-secret',
}

describe('authorization configuration', () => {
  it('defaults to the single-user mode without remote access', () => {
    expect(authConfigFromEnv({})).toEqual({ mode: 'none' })
  })

  it('loads a complete OAuth configuration', () => {
    const config = authConfigFromEnv({ ...oauthEnv, TGS_ADMIN_TELEGRAM_IDS: ' 42, 7 ,' })
    expect(config).toMatchObject({
      mode: 'oauth',
      publicUrl: 'https://tgs.example.com',
      telegram: { clientId: '123456789', clientSecret: 'synthetic-client-secret' },
    })
    expect(config.mode === 'oauth' && [...config.adminTelegramIds]).toEqual(['42', '7'])
  })

  it.each(['TGS_PUBLIC_URL', 'BETTER_AUTH_SECRET', 'TELEGRAM_LOGIN_CLIENT_ID', 'TELEGRAM_LOGIN_CLIENT_SECRET'])('refuses OAuth without %s', (name) => {
    expect(() => authConfigFromEnv({ ...oauthEnv, [name]: undefined })).toThrow(name)
  })

  it('rejects insecure or ambiguous public URLs and weak secrets', () => {
    expect(() => authConfigFromEnv({ ...oauthEnv, TGS_PUBLIC_URL: 'http://tgs.example.com' })).toThrow('HTTPS')
    expect(() => authConfigFromEnv({ ...oauthEnv, TGS_PUBLIC_URL: 'https://tgs.example.com/app' })).toThrow('without a path')
    expect(() => authConfigFromEnv({ ...oauthEnv, BETTER_AUTH_SECRET: 'short' })).toThrow('32')
    expect(() => authConfigFromEnv({ ...oauthEnv, TGS_ADMIN_TELEGRAM_IDS: 'admin' })).toThrow('decimal')
  })

  it.each(['TG_SEARCH_REMOTE_ACCESS', 'TG_SEARCH_REMOTE_TOKEN'])('fails fast on the removed %s variable', (name) => {
    // Static credentials were removed; ignoring them would leave an operator believing the old policy still applies.
    expect(() => authConfigFromEnv({ [name]: '{}' })).toThrow('no longer supported')
  })
})
