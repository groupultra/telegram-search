import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveProfilePaths } from './profile'
import { CLI_CLIENT_ID, deleteRemoteToken, loginRemote, readRemoteToken, remoteAccessToken } from './remote-auth'

const endpoint = 'https://tgs.example.test'
type FetchInput = string | URL | Request

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function profilePaths() {
  const root = await mkdtemp(join(tmpdir(), 'tg-remote-auth-'))
  roots.push(root)
  return { ...resolveProfilePaths('test'), root, remoteToken: join(root, 'remote-token.json') }
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

describe('remote device login', () => {
  it('requests owner scopes for the MCP resource, polls through pending and slow_down, and stores tokens privately', async () => {
    const paths = await profilePaths()
    const requests: Array<{ url: string, body: URLSearchParams }> = []
    const tokenResponses = [
      json({ error: 'authorization_pending' }, 400),
      json({ error: 'slow_down' }, 400),
      json({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, scope: 'messages:read offline_access' }),
    ]
    const fetch = vi.fn(async (url: FetchInput, init?: RequestInit) => {
      requests.push({ url: String(url), body: new URLSearchParams(String(init?.body)) })
      if (String(url).endsWith('/device/code'))
        return json({ device_code: 'device', user_code: 'ABCD-EFGH', verification_uri: `${endpoint}/device`, verification_uri_complete: `${endpoint}/device?user_code=ABCD-EFGH`, expires_in: 600, interval: 5 })
      return tokenResponses.shift()!
    }) as unknown as typeof globalThis.fetch
    const sleeps: number[] = []
    const onVerification = vi.fn()

    const token = await loginRemote(paths, `${endpoint}/`, { fetch, now: () => 1_000, sleep: async (ms) => {
      sleeps.push(ms)
    }, onVerification })

    expect(requests[0]!.url).toBe(`${endpoint}/api/auth/device/code`)
    expect(Object.fromEntries(requests[0]!.body)).toEqual({ client_id: CLI_CLIENT_ID, scope: 'chats:read messages:read media:read offline_access', resource: `${endpoint}/mcp` })
    expect(onVerification).toHaveBeenCalledWith(expect.objectContaining({ userCode: 'ABCD-EFGH', verificationUriComplete: `${endpoint}/device?user_code=ABCD-EFGH` }))
    // RFC 8628: slow_down adds five seconds to every later poll.
    expect(sleeps).toEqual([5_000, 5_000, 10_000])
    expect(token).toEqual({ endpoint, accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 3_601_000, scopes: ['messages:read', 'offline_access'] })
    expect(await readRemoteToken(paths)).toEqual(token)
    expect((await stat(paths.remoteToken)).mode & 0o777).toBe(0o600)
  })

  it('requests database administration only when asked', async () => {
    const paths = await profilePaths()
    let scope = ''
    const fetch = vi.fn(async (url: FetchInput, init?: RequestInit) => {
      if (String(url).endsWith('/device/code')) {
        scope = new URLSearchParams(String(init?.body)).get('scope') ?? ''
        return json({ device_code: 'device', user_code: 'CODE', verification_uri: `${endpoint}/device`, expires_in: 600 })
      }
      return json({ error: 'access_denied' }, 400)
    }) as unknown as typeof globalThis.fetch
    await expect(loginRemote(paths, endpoint, { admin: true, fetch, sleep: async () => {}, onVerification: () => {} })).rejects.toMatchObject({ appError: { code: 'REMOTE_AUTHORIZATION_DENIED' } })
    expect(scope.split(' ')).toContain('database:admin')
    expect(await readRemoteToken(paths)).toBeUndefined()
  })
})

describe('remote access tokens', () => {
  async function stored(paths: Awaited<ReturnType<typeof profilePaths>>, expiresAt: number, refreshToken: string | null = 'refresh-1') {
    const fetch = vi.fn(async (url: FetchInput) => String(url).endsWith('/device/code')
      ? json({ device_code: 'd', user_code: 'u', verification_uri: 'v', expires_in: 600 })
      : json({ access_token: 'access-1', ...(refreshToken ? { refresh_token: refreshToken } : {}), expires_in: expiresAt / 1000 }))
    await loginRemote(paths, endpoint, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => 0, sleep: async () => {}, onVerification: () => {} })
  }

  it('returns a fresh token without network access and never sends it to another server', async () => {
    const paths = await profilePaths()
    await stored(paths, 3_600_000)
    const fetch = vi.fn() as unknown as typeof globalThis.fetch
    expect(await remoteAccessToken(paths, endpoint, { fetch, now: () => 1_000 })).toBe('access-1')
    await expect(remoteAccessToken(paths, 'https://other.example.test', { fetch, now: () => 1_000 })).rejects.toMatchObject({ appError: { code: 'REMOTE_CREDENTIALS_MISSING' } })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refreshes a token near expiry and keeps the refresh token when the response omits it', async () => {
    const paths = await profilePaths()
    await stored(paths, 3_600_000)
    const fetch = vi.fn(async (_url: FetchInput, init?: RequestInit) => {
      expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({ grant_type: 'refresh_token', refresh_token: 'refresh-1', client_id: CLI_CLIENT_ID, resource: `${endpoint}/mcp` })
      return json({ access_token: 'access-2', expires_in: 3600 })
    }) as unknown as typeof globalThis.fetch
    expect(await remoteAccessToken(paths, endpoint, { fetch, now: () => 3_560_000 })).toBe('access-2')
    expect(JSON.parse(await readFile(paths.remoteToken, 'utf8'))).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-1' })
  })

  it('treats a damaged token file as missing credentials', async () => {
    // A truncated file from an interrupted write threw a raw SyntaxError and broke the output contract.
    const paths = await profilePaths()
    await writeFile(paths.remoteToken, '{"endpoint": "https://tgs.exa')
    expect(await readRemoteToken(paths)).toBeUndefined()
    await expect(remoteAccessToken(paths, endpoint)).rejects.toMatchObject({ appError: { code: 'REMOTE_CREDENTIALS_MISSING' } })
  })

  it('asks for a new login when the refresh token is rejected or missing', async () => {
    const paths = await profilePaths()
    await stored(paths, 3_600_000)
    const rejected = vi.fn(async () => json({ error: 'invalid_grant' }, 400)) as unknown as typeof globalThis.fetch
    await expect(remoteAccessToken(paths, endpoint, { fetch: rejected, now: () => 4_000_000 })).rejects.toMatchObject({ appError: { code: 'REMOTE_CREDENTIALS_EXPIRED' } })

    const withoutRefresh = await profilePaths()
    await stored(withoutRefresh, 3_600_000, null)
    await expect(remoteAccessToken(withoutRefresh, endpoint, { now: () => 4_000_000 })).rejects.toMatchObject({ appError: { code: 'REMOTE_CREDENTIALS_EXPIRED' } })

    await deleteRemoteToken(paths)
    expect(await readRemoteToken(paths)).toBeUndefined()
  })
})
