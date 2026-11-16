import type { Middleware } from 'h3'

export type SessionUserLookup = (headers: Headers) => Promise<{ id: string } | undefined>

/**
 * Web UI authorization. Media routes need a Better Auth session. The
 * WebSocket stays open to signed-out browsers: logging in to Telegram over it
 * is how a user signs in (see telegram-session.ts), and its client-chosen,
 * unguessable `sessionId` already scopes the account runtime as in the
 * single-user mode.
 */
export function createSessionGuard(getSessionUser: SessionUserLookup, options: { publicUrl: string }) {
  const allowedOrigin = new URL(options.publicUrl).origin

  /** Throws a `Response`: crossws aborts an upgrade only on a thrown Response and turns other errors into 500. */
  async function authorizeWebSocket(request: Request): Promise<void> {
    // Another origin's page must not drive a user's Telegram runtime from their browser.
    const origin = request.headers.get('origin')
    if (origin !== null && origin !== allowedOrigin)
      throw new Response('Cross-origin WebSocket upgrades are not allowed', { status: 403 })
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
