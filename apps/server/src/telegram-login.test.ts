import type { JWTPayload } from 'jose'

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'

import { createTelegramIdTokenVerifier, TELEGRAM_OIDC_ISSUER } from './telegram-login'

const clientId = '123456789'

async function signer() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256' }
  const verify = createTelegramIdTokenVerifier({ clientId, keys: createLocalJWKSet({ keys: [jwk] }) })
  const sign = (claims: JWTPayload, options: { issuer?: string, audience?: string, expiresIn?: string } = {}) => new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.issuer ?? TELEGRAM_OIDC_ISSUER)
    .setAudience(options.audience ?? clientId)
    .setSubject('1234123412341234123')
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m')
    .sign(privateKey)
  return { verify, sign }
}

describe('telegram ID token verification', () => {
  it('reads the Telegram user ID from the id claim, not sub', async () => {
    const { verify, sign } = await signer()
    const identity = await verify(await sign({ id: 987654321, name: 'Test User', preferred_username: 'test_user' }))
    expect(identity).toEqual({ telegramId: '987654321', name: 'Test User', username: 'test_user', picture: undefined })
  })

  it.each([
    ['issuer', { issuer: 'https://attacker.example' }],
    ['audience', { audience: '999' }],
    ['expiry', { expiresIn: '-1m' }],
  ] as const)('rejects a token with the wrong %s', async (_name, options) => {
    const { verify, sign } = await signer()
    await expect(verify(await sign({ id: 987654321 }, options))).rejects.toThrow()
  })

  it('rejects a token signed by another key or missing the profile id', async () => {
    const trusted = await signer()
    const other = await signer()
    await expect(trusted.verify(await other.sign({ id: 987654321 }))).rejects.toThrow()
    // Without the profile scope Telegram omits `id`; such a login cannot be bound to a Telegram account.
    await expect(trusted.verify(await trusted.sign({}))).rejects.toThrow()
  })
})
