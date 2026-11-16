import type { CoreDB } from '@tg-search/core'
import type { Auth as BetterAuth } from 'better-auth'

import type { AuthConfig } from '../auth-config'

import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { mcp } from '@better-auth/mcp'
import { DEVICE_CODE_GRANT_TYPE, oauthDeviceAuthorization } from '@better-auth/oauth-provider'
import { authOauthClientResourceTable, authOauthClientTable, authSchema } from '@tg-search/core'
import { betterAuth } from 'better-auth'
import { genericOAuth, jwt } from 'better-auth/plugins'

import { ownerScopes, remoteScopes } from '../remote-scopes'
import { createTelegramIdTokenVerifier, TELEGRAM_OIDC_DISCOVERY_URL } from '../telegram-login'

export type OAuthConfig = Extract<AuthConfig, { mode: 'oauth' }>

/** Public client used by `tgs` for the device authorization grant. */
export const CLI_CLIENT_ID = 'tgs-cli'

/** Access-token claim carrying the signed-in user's Telegram ID. */
export const TELEGRAM_ID_CLAIM = 'telegram_id'

export const AUTH_BASE_PATH = '/api/auth'

export function oauthUrls(config: OAuthConfig) {
  return {
    /** Better Auth's base URL includes its base path, so the token issuer does too. */
    issuer: `${config.publicUrl}${AUTH_BASE_PATH}`,
    /** The protected resource for MCP and the REST remote API; tokens are audience-bound to it. */
    resource: `${config.publicUrl}/mcp`,
  }
}

interface TelegramProfile extends Record<string, unknown> {
  telegramId: string
}

export interface CreateAuthOptions {
  db: CoreDB
  config: OAuthConfig
}

/**
 * The configured Better Auth instance. Annotated with the base `Auth` type: the
 * inferred plugin-specific type is too large for declaration emit, and the
 * server only uses the handler, the session API, and the context.
 */
export type Auth = BetterAuth

export function createAuth({ db, config }: CreateAuthOptions): Auth {
  const { resource } = oauthUrls(config)
  const verifyTelegramIdToken = createTelegramIdTokenVerifier({ clientId: config.telegram.clientId })
  // Token claims are issued after the instance exists, so the callback reads the context through this holder.
  const instance: { context?: Auth['$context'] } = {}
  const auth = betterAuth({
    appName: 'Telegram Search',
    baseURL: config.publicUrl,
    basePath: AUTH_BASE_PATH,
    secret: config.secret,
    trustedOrigins: [config.publicUrl],
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    // Telegram returns no email, so every user carries a synthetic address; linking by email must never match one.
    account: { accountLinking: { enabled: false } },
    plugins: [
      jwt(),
      mcp({
        resource,
        loginPage: '/login',
        consentPage: '/consent',
        scopes: ['openid', 'profile', 'offline_access', ...remoteScopes],
        clientRegistrationDefaultScopes: ['offline_access', ...ownerScopes],
        clientRegistrationAllowedScopes: ['openid', 'profile', 'offline_access', ...remoteScopes],
        customAccessTokenClaims: async ({ user }) => {
          if (!user || !instance.context)
            return {}
          // The linked Telegram account is keyed by the verified ID token's `id` claim (see `accountSubject`).
          // It is never user-editable, unlike a user field.
          const { adapter } = await instance.context
          const account = await adapter.findOne<{ accountId: string }>({
            model: 'account',
            where: [{ field: 'userId', value: user.id }, { field: 'providerId', value: 'telegram' }],
          })
          return account ? { [TELEGRAM_ID_CLAIM]: account.accountId } : {}
        },
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' }),
      oauthDeviceAuthorization({ verificationUri: '/device' }),
      genericOAuth({
        config: [{
          providerId: 'telegram',
          name: 'Telegram',
          clientId: config.telegram.clientId,
          clientSecret: config.telegram.clientSecret,
          discoveryUrl: TELEGRAM_OIDC_DISCOVERY_URL,
          authentication: 'basic',
          pkce: true,
          scopes: ['openid', 'profile'],
          // Telegram has no UserInfo endpoint; the ID token is the only identity source.
          getUserInfo: async (tokens) => {
            if (!tokens.idToken)
              return null
            const identity = await verifyTelegramIdToken(tokens.idToken)
            return {
              telegramId: identity.telegramId,
              // NOTICE: Better Auth requires an email and Telegram returns none. The `.invalid` TLD
              // (RFC 2606) can never receive mail or match a real address; email sign-in and linking stay disabled.
              email: `tg-${identity.telegramId}@users.telegram.invalid`,
              emailVerified: false,
              name: identity.name ?? identity.username ?? `Telegram ${identity.telegramId}`,
              image: identity.picture,
            }
          },
          // Key the linked account by the Telegram user ID instead of the opaque OIDC `sub`.
          accountSubject: ({ profile }) => (profile as unknown as TelegramProfile).telegramId,
        }],
      }),
    ],
  })
  // NOTICE: the plugin-specific instance type is too large for declaration emit (TS7056), and its
  // adapter generic is invariant, so it is not assignable to the base `Auth` without this cast.
  // Callers only use the handler, `api.getSession`, and `$context`, which the base type describes.
  const typed = auth as unknown as Auth
  instance.context = typed.$context
  return typed
}

/**
 * Registers the public CLI client for the device grant. Better Auth only
 * creates clients for a signed-in user, so the row is written directly.
 */
export async function ensureCliClient(db: CoreDB, auth: Auth, config: OAuthConfig): Promise<void> {
  // Wait for the provider to seed the configured protected resource that the client links to.
  await auth.$context
  const now = new Date()
  await db.insert(authOauthClientTable).values({
    id: CLI_CLIENT_ID,
    clientId: CLI_CLIENT_ID,
    name: 'Telegram Search CLI',
    redirectUris: [],
    tokenEndpointAuthMethod: 'none',
    grantTypes: [DEVICE_CODE_GRANT_TYPE, 'refresh_token'],
    responseTypes: [],
    // Administrators run `tgs db` remotely; the resource server drops `database:admin` for everyone else.
    scopes: ['offline_access', ...remoteScopes],
    disabled: false,
    skipConsent: false,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing({ target: authOauthClientTable.clientId })
  await db.insert(authOauthClientResourceTable).values({
    id: `${CLI_CLIENT_ID}:resource`,
    clientId: CLI_CLIENT_ID,
    resourceId: oauthUrls(config).resource,
    createdAt: now,
  }).onConflictDoNothing()
}
