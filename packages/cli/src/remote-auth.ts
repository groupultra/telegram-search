import type { InferOutput } from 'valibot'

import type { ProfilePaths } from './profile'

import { randomUUID } from 'node:crypto'
import { chmod, readFile, rename, rm, writeFile } from 'node:fs/promises'

import { ApplicationError } from '@tg-search/core'
import { normalizeRemoteUrl } from '@tg-search/protocol'
import { array, integer, number, object, optional, pipe, safeParse, string } from 'valibot'

/** Public OAuth client registered by every TGS server for the device authorization grant. */
export const CLI_CLIENT_ID = 'tgs-cli'
const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'
export const OWNER_SCOPES = ['chats:read', 'messages:read', 'media:read'] as const
export const ADMIN_SCOPE = 'database:admin'
/** Refresh slightly before expiry so a request never starts with a token about to lapse. */
const REFRESH_MARGIN_MS = 60_000

const storedTokenSchema = object({
  endpoint: string(),
  accessToken: string(),
  refreshToken: optional(string()),
  expiresAt: pipe(number(), integer()),
  scopes: array(string()),
})

export type StoredRemoteToken = InferOutput<typeof storedTokenSchema>

const tokenResponseSchema = object({
  access_token: string(),
  refresh_token: optional(string()),
  expires_in: pipe(number(), integer()),
  scope: optional(string()),
})

const deviceCodeSchema = object({
  device_code: string(),
  user_code: string(),
  verification_uri: string(),
  verification_uri_complete: optional(string()),
  expires_in: pipe(number(), integer()),
  interval: optional(pipe(number(), integer())),
})

export interface DeviceVerification {
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  expiresAt: number
}

export interface RemoteAuthOptions {
  fetch?: typeof fetch
  now?: () => number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

function authError(code: string, message: string, retryable = false): ApplicationError {
  return new ApplicationError({ code, message, retryable })
}

function oauthEndpoints(endpoint: string) {
  const url = normalizeRemoteUrl(endpoint)
  return {
    url,
    deviceCode: `${url}/api/auth/device/code`,
    token: `${url}/api/auth/oauth2/token`,
    // Tokens are audience-bound to the server's MCP resource; the REST remote API accepts the same audience.
    resource: `${url}/mcp`,
  }
}

function form(values: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams(values).toString(),
    redirect: 'error',
  }
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted()
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  })
}

export async function readRemoteToken(paths: ProfilePaths): Promise<StoredRemoteToken | undefined> {
  let raw: string
  try {
    raw = await readFile(paths.remoteToken, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return undefined
    throw error
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  }
  catch {
    // A damaged file means the sign-in is unusable; report missing credentials instead of a raw SyntaxError.
    return undefined
  }
  const parsed = safeParse(storedTokenSchema, value)
  return parsed.success ? parsed.output : undefined
}

async function writeRemoteToken(paths: ProfilePaths, token: StoredRemoteToken): Promise<void> {
  // Write then rename so a concurrent `tgs` process never reads a half-written token file.
  const temporary = `${paths.remoteToken}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 })
    await chmod(temporary, 0o600)
    await rename(temporary, paths.remoteToken)
  }
  finally {
    await rm(temporary, { force: true })
  }
}

export async function deleteRemoteToken(paths: ProfilePaths): Promise<void> {
  await rm(paths.remoteToken, { force: true })
}

function storedToken(endpoint: string, response: unknown, now: number, previous?: StoredRemoteToken): StoredRemoteToken {
  const parsed = safeParse(tokenResponseSchema, response)
  if (!parsed.success)
    throw authError('REMOTE_PROTOCOL_MISMATCH', 'Remote server returned an invalid token response')
  return {
    endpoint,
    accessToken: parsed.output.access_token,
    // Refresh responses may omit the refresh token when it is not rotated.
    refreshToken: parsed.output.refresh_token ?? previous?.refreshToken,
    expiresAt: now + parsed.output.expires_in * 1000,
    scopes: parsed.output.scope?.split(' ').filter(Boolean) ?? previous?.scopes ?? [],
  }
}

/**
 * Signs this profile in to a remote server with the OAuth device authorization
 * grant (RFC 8628). The user approves the code in a browser where they are
 * signed in to the server with Telegram.
 */
export async function loginRemote(paths: ProfilePaths, endpoint: string, options: RemoteAuthOptions & {
  admin?: boolean
  signal?: AbortSignal
  onVerification: (verification: DeviceVerification) => void
}): Promise<StoredRemoteToken> {
  const doFetch = options.fetch ?? fetch
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? defaultSleep
  const urls = oauthEndpoints(endpoint)
  const scopes = [...OWNER_SCOPES, ...(options.admin ? [ADMIN_SCOPE] : []), 'offline_access']
  const issued = await doFetch(urls.deviceCode, { ...form({ client_id: CLI_CLIENT_ID, scope: scopes.join(' '), resource: urls.resource }), signal: options.signal })
  const device = safeParse(deviceCodeSchema, await issued.json().catch(() => undefined))
  if (!issued.ok || !device.success)
    throw authError('REMOTE_AUTHENTICATION_FAILED', `Remote server refused device authorization (HTTP ${issued.status})`)
  const expiresAt = now() + device.output.expires_in * 1000
  options.onVerification({
    userCode: device.output.user_code,
    verificationUri: device.output.verification_uri,
    verificationUriComplete: device.output.verification_uri_complete,
    expiresAt,
  })

  let intervalMs = (device.output.interval ?? 5) * 1000
  while (now() < expiresAt) {
    await sleep(intervalMs, options.signal)
    const response = await doFetch(urls.token, { ...form({ grant_type: DEVICE_CODE_GRANT_TYPE, device_code: device.output.device_code, client_id: CLI_CLIENT_ID }), signal: options.signal })
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined
    if (response.ok) {
      const token = storedToken(urls.url, body, now())
      await writeRemoteToken(paths, token)
      return token
    }
    switch (body?.error) {
      case 'authorization_pending':
        continue
      case 'slow_down':
        // RFC 8628 §3.5: increase the polling interval by five seconds.
        intervalMs += 5_000
        continue
      case 'access_denied':
        throw authError('REMOTE_AUTHORIZATION_DENIED', 'The device authorization was denied')
      case 'expired_token':
        throw authError('REMOTE_AUTHORIZATION_EXPIRED', 'The device code expired; run remote login again')
      default:
        throw authError('REMOTE_AUTHENTICATION_FAILED', `Remote server rejected the device authorization (HTTP ${response.status})`)
    }
  }
  throw authError('REMOTE_AUTHORIZATION_EXPIRED', 'The device code expired; run remote login again')
}

/**
 * Returns a valid access token for `endpoint`, refreshing it when it is about
 * to expire. Tokens issued for another server are never sent.
 */
export async function remoteAccessToken(paths: ProfilePaths, endpoint: string, options: RemoteAuthOptions & { signal?: AbortSignal } = {}): Promise<string> {
  const doFetch = options.fetch ?? fetch
  const now = options.now ?? Date.now
  const urls = oauthEndpoints(endpoint)
  const stored = await readRemoteToken(paths)
  if (!stored || stored.endpoint !== urls.url)
    throw authError('REMOTE_CREDENTIALS_MISSING', 'Run `tgs remote login` to sign in to this remote server')
  if (stored.expiresAt - REFRESH_MARGIN_MS > now())
    return stored.accessToken
  if (!stored.refreshToken)
    throw authError('REMOTE_CREDENTIALS_EXPIRED', 'The remote access token expired; run `tgs remote login` again')

  const response = await doFetch(urls.token, { ...form({ grant_type: 'refresh_token', refresh_token: stored.refreshToken, client_id: CLI_CLIENT_ID, resource: urls.resource }), signal: options.signal })
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    if (response.status === 400 || response.status === 401)
      throw authError('REMOTE_CREDENTIALS_EXPIRED', 'The remote sign-in expired or was revoked; run `tgs remote login` again')
    throw authError('REMOTE_UNAVAILABLE', `Remote server could not refresh the access token (HTTP ${response.status})`, true)
  }
  const refreshed = storedToken(urls.url, body, now(), stored)
  await writeRemoteToken(paths, refreshed)
  return refreshed.accessToken
}
