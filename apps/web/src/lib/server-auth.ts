/**
 * Browser client for the server's OAuth authorization endpoints (Better Auth
 * under `/api/auth`). The proxy forwards this prefix unchanged, unlike `/api`.
 */

export const AUTH_BASE = '/api/auth'

/** Web pages of the authorization flow; they run before a Telegram account is ready. */
export const SIGN_IN_PATH = '/auth/sign-in'

export function isServerAuthRoute(path: string): boolean {
  return path === '/auth' || path.startsWith('/auth/')
}

export type ServerAuthStatus = 'disabled' | 'signed-out' | 'signed-in'

export interface PublicClient {
  clientId: string
  name?: string
  uri?: string
  logoUri?: string
}

export interface DeviceAuthorization {
  userCode: string
  status: 'pending' | 'approved' | 'denied'
  clientId?: string
  scopes: string[]
}

export class ServerAuthError extends Error {
  constructor(public readonly status: number, public readonly code: string | undefined, message: string) {
    super(message)
    this.name = 'ServerAuthError'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${AUTH_BASE}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  const body = await response.json().catch(() => undefined) as Record<string, unknown> | null | undefined
  if (!response.ok) {
    const message = typeof body?.message === 'string' ? body.message : `Request failed (HTTP ${response.status})`
    throw new ServerAuthError(response.status, typeof body?.code === 'string' ? body.code : undefined, message)
  }
  return body as T
}

/**
 * `disabled` when the server runs without OAuth (`TGS_AUTH=none`): the auth
 * routes do not exist there, so the session endpoint answers 404.
 */
export async function getServerAuthStatus(): Promise<ServerAuthStatus> {
  try {
    const session = await request<{ user?: { id: string } } | null>('/get-session')
    return session?.user ? 'signed-in' : 'signed-out'
  }
  catch (error) {
    if (error instanceof ServerAuthError && error.status === 404)
      return 'disabled'
    throw error
  }
}

/** Only same-origin paths may follow sign-in, so a crafted link cannot redirect elsewhere. */
export function safeRedirectPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return fallback
  return value
}

/**
 * Exchanges a sign-in ticket from the WebSocket bridge for a session cookie.
 * With `oauthQuery` (the signed authorization request the server sent to the
 * sign-in page) the server resumes that request and returns where to go next.
 */
export async function exchangeSignInTicket(ticket: string, oauthQuery?: string): Promise<{ redirectUrl?: string }> {
  const result = await request<{ redirect?: boolean, url?: string }>('/sign-in/telegram-session', {
    method: 'POST',
    body: JSON.stringify({ ticket, ...(oauthQuery ? { oauth_query: oauthQuery } : {}) }),
  })
  return { redirectUrl: result.redirect && result.url ? result.url : undefined }
}

interface PublicClientResponse {
  client_id: string
  client_name?: string
  client_uri?: string
  logo_uri?: string
}

function toPublicClient(client: PublicClientResponse): PublicClient {
  return { clientId: client.client_id, name: client.client_name, uri: client.client_uri, logoUri: client.logo_uri }
}

/** Client display fields for a signed-in user. */
export async function getPublicClient(clientId: string): Promise<PublicClient> {
  return toPublicClient(await request<PublicClientResponse>(`/oauth2/public-client?${new URLSearchParams({ client_id: clientId })}`))
}

/** Client display fields before sign-in; the server accepts this only with its signed authorization request. */
export async function getPublicClientBeforeSignIn(clientId: string, oauthQuery: string): Promise<PublicClient> {
  return toPublicClient(await request<PublicClientResponse>('/oauth2/public-client-prelogin', {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId, oauth_query: oauthQuery }),
  }))
}

/** The query string as the server signed it; re-encoding would break its signature. */
export function currentOAuthQuery(): string {
  return window.location.search.replace(/^\?/, '')
}

/** Completes the consent step and returns the URL that hands the authorization code to the client. */
export async function submitConsent(options: { accept: boolean, oauthQuery: string }): Promise<string> {
  const result = await request<{ url?: string, redirect_uri?: string }>('/oauth2/consent', {
    method: 'POST',
    body: JSON.stringify({ accept: options.accept, oauth_query: options.oauthQuery }),
  })
  const url = result.url ?? result.redirect_uri
  if (!url)
    throw new ServerAuthError(500, undefined, 'The server did not return a redirect URL')
  return url
}

export function normalizeUserCode(value: string): string {
  return value.replace(/[\s-]/g, '').toUpperCase()
}

/** Binds a device code to the signed-in user and returns what it requests. */
export async function getDeviceAuthorization(userCode: string): Promise<DeviceAuthorization> {
  const result = await request<{ user_code: string, status: DeviceAuthorization['status'], client_id?: string, scope?: string }>(`/device?${new URLSearchParams({ user_code: normalizeUserCode(userCode) })}`)
  return {
    userCode: result.user_code,
    status: result.status,
    clientId: result.client_id,
    scopes: result.scope?.split(' ').filter(Boolean) ?? [],
  }
}

export async function decideDeviceAuthorization(userCode: string, approve: boolean): Promise<void> {
  await request(approve ? '/device/approve' : '/device/deny', {
    method: 'POST',
    body: JSON.stringify({ userCode: normalizeUserCode(userCode) }),
  })
}
