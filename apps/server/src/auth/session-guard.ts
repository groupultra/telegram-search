import type { Middleware } from 'h3'

export type SessionUserLookup = (headers: Headers) => Promise<{ id: string } | undefined>

/**
 * Web UI authorization: a Better Auth session cookie is required, and each
 * WebSocket `sessionId` belongs to the first user that opened it.
 */
export function createSessionGuard(getSessionUser: SessionUserLookup) {
  // WebSocket session IDs are client-chosen and key the in-memory account state, so bind each one to its user.
  const sessionOwners = new Map<string, string>()

  /** Throws a `Response`: crossws aborts an upgrade only on a thrown Response and turns other errors into 500. */
  async function authorizeWebSocket(request: Request, sessionId: string): Promise<void> {
    const user = await getSessionUser(request.headers)
    if (!user)
      throw new Response('Sign in is required', { status: 401 })
    const owner = sessionOwners.get(sessionId)
    if (owner !== undefined && owner !== user.id)
      throw new Response('This session belongs to another user', { status: 403 })
    sessionOwners.set(sessionId, user.id)
  }

  /** Requires a signed-in user for the given path prefixes. */
  function requireSession(prefixes: readonly string[]): Middleware {
    return async (event) => {
      if (!prefixes.some(prefix => event.url.pathname.startsWith(prefix)))
        return
      if (!await getSessionUser(event.req.headers))
        return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  return { authorizeWebSocket, requireSession }
}
