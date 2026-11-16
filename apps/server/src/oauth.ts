import type { CoreDB } from '@tg-search/core'
import type { H3 } from 'h3'

import type { OAuthConfig } from './auth/better-auth'
import type { RemoteApplication } from './remote/application'

import { models } from '@tg-search/core'

import { createAuth, ensureCliClient, oauthUrls } from './auth/better-auth'
import { createClaimsVerifier, createOAuthRemoteAuthenticator, createPrincipalResolver } from './auth/principal'
import { createSessionGuard } from './auth/session-guard'
import { issueTelegramSessionTicket } from './auth/telegram-session'
import { createMcpEndpoint } from './mcp/server'
import { createRemoteAuditRecorder } from './remote/audit'
import { createRemoteExecutor } from './remote/executor'
import { createRemoteApi } from './remote/http'
import { createRemoteMediaLinks } from './remote/media-links'

export interface MountOAuthOptions {
  db: CoreDB
  config: OAuthConfig
  getApplication: (accountId: string) => RemoteApplication
}

/**
 * Mounts the authorization server, the MCP endpoint, and the REST remote API,
 * and returns the Web route guard and the sign-in ticket issuer for the WebSocket bridge.
 */
export async function mountOAuth(app: H3, { db, config, getApplication }: MountOAuthOptions) {
  const auth = createAuth({ db, config })
  await ensureCliClient(db, auth, config)

  const { resource } = oauthUrls(config)
  const verify = createClaimsVerifier(auth, resource)
  const resolvePrincipal = createPrincipalResolver({
    findAccountId: telegramId => models.accountModels.findAccountIdByPlatformUserId(db, 'telegram', telegramId),
    findClientName: async (clientId) => {
      const { adapter } = await auth.$context
      const client = await adapter.findOne<{ name?: string | null }>({ model: 'oauthClient', where: [{ field: 'clientId', value: clientId }] })
      return client?.name ?? undefined
    },
    adminTelegramIds: config.adminTelegramIds,
  })
  // Media tickets derive their own key from the server secret; see remote/media-links.ts.
  const media = createRemoteMediaLinks({ secret: config.secret }, getApplication)
  const executor = createRemoteExecutor({ getApplication, recordAudit: createRemoteAuditRecorder(db), media })

  // Better Auth serves its endpoints under the base path and OAuth discovery at the origin root.
  app.all('/api/auth/**', event => auth.handler(event.req))
  app.all('/.well-known/**', event => auth.handler(event.req))
  const mcp = createMcpEndpoint({ publicUrl: config.publicUrl, verify, resolvePrincipal, executor })
  app.all('/mcp', event => mcp(event.req))
  app.mount('/v1/remote', createRemoteApi(createOAuthRemoteAuthenticator(verify, resolvePrincipal), executor, media))

  const guard = createSessionGuard(async (headers) => {
    const session = await auth.api.getSession({ headers })
    return session?.user ? { id: session.user.id } : undefined
  }, { publicUrl: config.publicUrl })
  return {
    guard,
    issueSignInTicket: (identity: { telegramId: string, name?: string }) => issueTelegramSessionTicket(auth, identity),
  }
}
