import type { CoreDB } from '@tg-search/core'
import type { Auth as BetterAuth } from 'better-auth'

import type { AuthConfig } from './config'

import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { mcp } from '@better-auth/mcp'
import { DEVICE_CODE_GRANT_TYPE, oauthDeviceAuthorization } from '@better-auth/oauth-provider'
import { authOauthClientResourceTable, authOauthClientTable, authSchema } from '@tg-search/core'
import { betterAuth } from 'better-auth'
import { jwt } from 'better-auth/plugins'

import { ownerScopes, remoteScopes } from '../remote/scopes'
import { TELEGRAM_PROVIDER_ID, telegramSessionSignIn } from './telegram-session'

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
  // Token claims are issued after the instance exists, so the callback reads the context through this holder.
  const instance: { context?: Auth['$context'] } = {}
  const auth = betterAuth({
    appName: 'Telegram Search',
    baseURL: config.publicUrl,
    basePath: AUTH_BASE_PATH,
    secret: config.secret,
    trustedOrigins: [config.publicUrl],
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    // Users carry a synthetic email (see telegram-session.ts); linking by email must never match one.
    account: { accountLinking: { enabled: false } },
    plugins: [
      jwt(),
      mcp({
        resource,
        loginPage: '/auth/sign-in',
        consentPage: '/auth/consent',
        scopes: ['openid', 'profile', 'offline_access', ...remoteScopes],
        // Clients such as ChatGPT request every scope the discovery documents list. List only what a
        // self-registered client may hold; `tgs-cli` still requests `database:admin` explicitly.
        advertisedMetadata: { scopes_supported: ['openid', 'profile', 'offline_access', ...ownerScopes] },
        clientRegistrationDefaultScopes: ['offline_access', ...ownerScopes],
        // Third-party clients register themselves (CIMD), so they can never ask for database administration; only `tgs-cli` can.
        clientRegistrationAllowedScopes: ['openid', 'profile', 'offline_access', ...ownerScopes],
        customAccessTokenClaims: async ({ user }) => {
          if (!user || !instance.context)
            return {}
          // The linked Telegram account is keyed by the Telegram user ID proven by the MTProto login
          // (see telegram-session.ts). It is never user-editable, unlike a user field.
          const { adapter } = await instance.context
          const account = await adapter.findOne<{ accountId: string }>({
            model: 'account',
            where: [{ field: 'userId', value: user.id }, { field: 'providerId', value: TELEGRAM_PROVIDER_ID }],
          })
          return account ? { [TELEGRAM_ID_CLAIM]: account.accountId } : {}
        },
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' }),
      oauthDeviceAuthorization({ verificationUri: '/auth/device' }),
      telegramSessionSignIn(),
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
  const policy = {
    name: 'Telegram Search CLI',
    redirectUris: [],
    tokenEndpointAuthMethod: 'none',
    grantTypes: [DEVICE_CODE_GRANT_TYPE, 'refresh_token'],
    responseTypes: [],
    // Administrators run `tgs db` remotely; the resource server drops `database:admin` for everyone else.
    scopes: ['offline_access', ...remoteScopes],
    disabled: false,
    skipConsent: false,
    updatedAt: now,
  }
  // Upsert so a changed client policy applies on the next start instead of keeping the first row forever.
  await db.insert(authOauthClientTable).values({ id: CLI_CLIENT_ID, clientId: CLI_CLIENT_ID, createdAt: now, ...policy }).onConflictDoUpdate({ target: authOauthClientTable.clientId, set: policy })
  // Link the client to the current resource. A row per resource survives a TGS_PUBLIC_URL change,
  // where a fixed link would keep pointing at the old resource and fail every device login with invalid_target.
  const resourceId = oauthUrls(config).resource
  await db.insert(authOauthClientResourceTable).values({
    id: `${CLI_CLIENT_ID}:${resourceId}`,
    clientId: CLI_CLIENT_ID,
    resourceId,
    createdAt: now,
  }).onConflictDoNothing()
}
