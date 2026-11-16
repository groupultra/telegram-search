import type { RemoteMethod } from '@tg-search/protocol'

/**
 * OAuth scopes granted to API and MCP clients, each expanding to the remote
 * methods it allows. Identity scopes (`openid`, `profile`, `offline_access`)
 * stay with the authorization server and grant no method.
 */
export const remoteScopeMethods = {
  'chats:read': ['chats.list'],
  'messages:read': ['messages.get', 'messages.replies', 'messages.read', 'messages.list', 'messages.query', 'messages.search', 'messages.context', 'stats.get'],
  'media:read': ['media.read', 'media.createLink'],
  // Database administration acts on the whole server database; only configured administrators receive it.
  'database:admin': ['database.indexes.list', 'database.indexes.drop', 'database.indexes.rebuild', 'database.vector.get', 'database.vector.set'],
} as const satisfies Record<string, readonly RemoteMethod[]>

export type RemoteScope = keyof typeof remoteScopeMethods

export const remoteScopes = Object.keys(remoteScopeMethods) as RemoteScope[]

/** Scopes any signed-in owner may grant to a client for their own account. */
export const ownerScopes: readonly RemoteScope[] = ['chats:read', 'messages:read', 'media:read']

export function isRemoteScope(value: string): value is RemoteScope {
  return Object.hasOwn(remoteScopeMethods, value)
}

export function capabilitiesFromScopes(scopes: Iterable<string>): Set<RemoteMethod> {
  const capabilities = new Set<RemoteMethod>()
  for (const scope of scopes) {
    if (isRemoteScope(scope)) {
      for (const method of remoteScopeMethods[scope])
        capabilities.add(method)
    }
  }
  return capabilities
}
