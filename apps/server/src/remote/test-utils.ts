import type { RemoteMethod } from '@tg-search/protocol'

import type { RemoteAuthenticator, RemotePrincipal } from './executor'

/** Test-only principal builder that mirrors the scope shapes OAuth tokens produce. */
export function testPrincipal(options: {
  accountId: string
  clientId?: string
  capabilities: readonly RemoteMethod[]
  /** `*` grants every chat, like an owner token. */
  chatIds: readonly string[]
}): RemotePrincipal {
  return {
    clientId: options.clientId ?? 'https://client.example/metadata.json',
    clientName: 'project-reader',
    userId: 'user-1',
    accountId: options.accountId,
    capabilities: new Set(options.capabilities),
    readableChatIds: options.chatIds.includes('*') ? undefined : [...new Set(options.chatIds)].sort(),
  }
}

/** Test-only authenticator that accepts exactly one bearer token. */
export function bearerTestAuthenticator(token: string, principal: RemotePrincipal): RemoteAuthenticator {
  return async (request) => {
    if (request.headers.get('authorization') !== `Bearer ${token}`)
      return { response: new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } }) }
    return { principal }
  }
}
