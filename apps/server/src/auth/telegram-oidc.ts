import type { JWTVerifyGetKey } from 'jose'

import { createRemoteJWKSet, jwtVerify } from 'jose'
import { number, object, optional, parse, pipe, regex, safeInteger, string, transform, union } from 'valibot'

export const TELEGRAM_OIDC_ISSUER = 'https://oauth.telegram.org'
export const TELEGRAM_OIDC_DISCOVERY_URL = `${TELEGRAM_OIDC_ISSUER}/.well-known/openid-configuration`
const TELEGRAM_JWKS_URL = `${TELEGRAM_OIDC_ISSUER}/.well-known/jwks.json`

export interface TelegramIdentity {
  /** Telegram user ID from the `id` claim; `sub` is a different identifier. */
  telegramId: string
  name?: string
  username?: string
  picture?: string
}

const telegramClaimsSchema = object({
  // The `profile` scope carries the user ID; tokens without it cannot be bound to an account.
  id: pipe(union([pipe(number(), safeInteger(), transform(String)), pipe(string(), regex(/^\d{1,20}$/))]), transform(String)),
  name: optional(string()),
  preferred_username: optional(string()),
  picture: optional(string()),
})

export interface TelegramIdTokenVerifierOptions {
  /** Bot ID from BotFather; Telegram uses it as the OAuth client ID and the token audience. */
  clientId: string
  /** Test injection; defaults to Telegram's published JWKS. */
  keys?: JWTVerifyGetKey
}

/**
 * Telegram publishes no UserInfo endpoint, so the signed ID token is the only
 * source of the user's identity. Verify signature, issuer, audience, and expiry
 * before trusting any claim.
 */
export function createTelegramIdTokenVerifier(options: TelegramIdTokenVerifierOptions) {
  const keys = options.keys ?? createRemoteJWKSet(new URL(TELEGRAM_JWKS_URL))
  return async function verifyTelegramIdToken(idToken: string): Promise<TelegramIdentity> {
    const { payload } = await jwtVerify(idToken, keys, {
      issuer: TELEGRAM_OIDC_ISSUER,
      audience: options.clientId,
      requiredClaims: ['exp', 'iat'],
    })
    const claims = parse(telegramClaimsSchema, payload)
    return {
      telegramId: claims.id,
      name: claims.name,
      username: claims.preferred_username,
      picture: claims.picture,
    }
  }
}
