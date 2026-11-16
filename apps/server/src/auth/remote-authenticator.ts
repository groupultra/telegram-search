import type { JWTPayload } from 'jose'

import type { RemoteAuthenticator, RemotePrincipal } from '../remote'
import type { Auth } from './auth'

import { requireMcpAuth } from '@better-auth/mcp'

import { capabilitiesFromScopes } from '../remote-scopes'
import { TELEGRAM_ID_CLAIM } from './auth'

export interface PrincipalResolverOptions {
  /** Maps a Telegram user ID to the TGS account recorded when that user signed in to Telegram on this server. */
  findAccountId: (telegramId: string) => Promise<string | undefined>
  findClientName: (clientId: string) => Promise<string | undefined>
  adminTelegramIds: ReadonlySet<string>
}

export type PrincipalResolution = { principal: RemotePrincipal } | { error: { status: 401 | 403, code: string, message: string } }

/**
 * Turns verified access-token claims into a principal. The tenancy rule is
 * strict: a token may act only on the account whose Telegram user ID equals
 * the signed-in user's own.
 */
export function createPrincipalResolver(options: PrincipalResolverOptions) {
  return async function resolvePrincipal(claims: JWTPayload): Promise<PrincipalResolution> {
    const clientId = typeof claims.azp === 'string' ? claims.azp : undefined
    const telegramId = claims[TELEGRAM_ID_CLAIM]
    if (!clientId || typeof claims.sub !== 'string' || typeof telegramId !== 'string')
      return { error: { status: 401, code: 'UNAUTHENTICATED', message: 'Access token is not bound to a Telegram user' } }

    const accountId = await options.findAccountId(telegramId)
    if (!accountId)
      return { error: { status: 403, code: 'TELEGRAM_NOT_CONNECTED', message: 'Sign in to Telegram on this server before connecting a client' } }

    const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : []
    // The consent screen may show every scope; database administration still needs a configured administrator.
    const granted = options.adminTelegramIds.has(telegramId) ? scopes : scopes.filter(scope => scope !== 'database:admin')
    return {
      principal: {
        clientId,
        clientName: await options.findClientName(clientId) ?? clientId,
        userId: claims.sub,
        accountId,
        capabilities: capabilitiesFromScopes(granted),
        // An owner token reads every chat of its own account; chat-level grants are a follow-up.
        readableChatIds: undefined,
      },
    }
  }
}

export type ClaimsVerifier = (request: Request) => Promise<{ claims: JWTPayload } | { response: Response }>

/**
 * Verifies the bearer access token (signature, issuer, audience, expiry, `azp`)
 * and returns the RFC 9728 challenge response when it is missing or invalid.
 */
export function createClaimsVerifier(auth: Auth, resource: string): ClaimsVerifier {
  return async (request) => {
    let verified: JWTPayload | undefined
    const response = await requireMcpAuth(auth, (_request, claims) => {
      verified = claims
      return new Response(null, { status: 204 })
    }, { resource })(request)
    return verified ? { claims: verified } : { response }
  }
}

export function createOAuthRemoteAuthenticator(verify: ClaimsVerifier, resolvePrincipal: ReturnType<typeof createPrincipalResolver>): RemoteAuthenticator {
  return async (request) => {
    const verified = await verify(request)
    if ('response' in verified)
      return verified
    const resolution = await resolvePrincipal(verified.claims)
    if ('error' in resolution) {
      const { status, code, message } = resolution.error
      return { response: Response.json({ ok: false, error: { code, message, retryable: false } }, { status, headers: { 'Cache-Control': 'no-store' } }) }
    }
    return resolution
  }
}
