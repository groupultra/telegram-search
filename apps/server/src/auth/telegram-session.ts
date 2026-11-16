import type { BetterAuthPlugin } from 'better-auth'

import type { Auth } from './better-auth'

import { createHash, randomBytes } from 'node:crypto'

import { APIError, createAuthEndpoint } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { maxLength, minLength, object, optional, parse, pipe, regex, string } from 'valibot'

/**
 * Signs a user in with the Telegram account they just logged in to over
 * MTProto. The WebSocket bridge issues a short-lived ticket once that account
 * is ready; the browser exchanges it here for a session cookie. Logging in to
 * Telegram (phone code, 2FA, or a saved session) is the identity proof: no
 * separate Telegram OAuth provider is involved.
 */

/** Provider ID of the linked account; its `accountId` is the Telegram user ID that access tokens carry. */
export const TELEGRAM_PROVIDER_ID = 'telegram'

const TICKET_TTL_MS = 120_000
const TICKET_PREFIX = 'telegram-session-ticket:'

const ticketValueSchema = object({
  telegramId: pipe(string(), regex(/^\d{1,20}$/)),
  name: optional(pipe(string(), maxLength(256))),
})

const signInBodySchema = object({
  ticket: pipe(string(), minLength(16), maxLength(128), regex(/^[\w-]+$/)),
  oauth_query: optional(pipe(string(), maxLength(8192))),
})

function ticketIdentifier(ticket: string): string {
  // Store only a hash, so a database reader cannot replay an unconsumed ticket.
  return `${TICKET_PREFIX}${createHash('sha256').update(ticket).digest('hex')}`
}

/**
 * Issues a single-use ticket for a Telegram user whose MTProto login is
 * complete. Callers must only pass the ID of the account they hold a live,
 * authorized Telegram session for.
 */
export async function issueTelegramSessionTicket(auth: Auth, identity: { telegramId: string, name?: string }): Promise<string> {
  const value = parse(ticketValueSchema, identity)
  const ticket = randomBytes(32).toString('base64url')
  const { internalAdapter } = await auth.$context
  await internalAdapter.createVerificationValue({
    identifier: ticketIdentifier(ticket),
    value: JSON.stringify(value),
    expiresAt: new Date(Date.now() + TICKET_TTL_MS),
  })
  return ticket
}

export function telegramSessionSignIn(): BetterAuthPlugin {
  return {
    id: 'telegram-session-sign-in',
    endpoints: {
      signInTelegramSession: createAuthEndpoint('/sign-in/telegram-session', {
        method: 'POST',
        body: signInBodySchema,
        requireHeaders: true,
      }, async (ctx) => {
        // Atomic and expiry-checked: only the first caller gets the row.
        const verification = await ctx.context.internalAdapter.consumeVerificationValue(ticketIdentifier(ctx.body.ticket))
        if (!verification)
          throw new APIError('UNAUTHORIZED', { message: 'Sign-in ticket is invalid or expired', code: 'INVALID_SIGN_IN_TICKET' })
        const identity = parse(ticketValueSchema, JSON.parse(verification.value))

        const accountKey = { providerId: TELEGRAM_PROVIDER_ID, accountId: identity.telegramId }
        let account = await ctx.context.internalAdapter.findAccountByKey(accountKey)
        if (!account) {
          try {
            // NOTICE: Better Auth requires an email and Telegram has none. The `.invalid` TLD (RFC 2606)
            // never receives mail or matches a real address; email sign-in and email linking stay disabled.
            ;({ account } = await ctx.context.internalAdapter.createOAuthUser({
              email: `tg-${identity.telegramId}@users.telegram.invalid`,
              emailVerified: false,
              name: identity.name || `Telegram ${identity.telegramId}`,
            }, accountKey))
          }
          catch (error) {
            // A concurrent first sign-in for the same Telegram user created the user (unique email) first.
            account = await ctx.context.internalAdapter.findAccountByKey(accountKey)
            if (!account)
              throw error
          }
        }

        const user = await ctx.context.internalAdapter.findUserById(account.userId)
        if (!user)
          throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Linked user is missing' })
        const session = await ctx.context.internalAdapter.createSession(user.id)
        await setSessionCookie(ctx, { session, user })

        // With `oauth_query`, the OAuth provider's hooks verify its signature before this handler and,
        // once the session cookie is set, resume `authorize`: the response becomes `{ redirect: true, url }`.
        return ctx.json({ userId: user.id })
      }),
    },
  }
}
