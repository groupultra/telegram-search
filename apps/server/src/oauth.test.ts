import type { TelegramApplication } from '@tg-search/core'
import type { JWTPayload } from 'jose'

import type { OAuthConfig } from './auth/better-auth'
import type { RemoteApplication } from './remote/application'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { authSchema, models, remoteAuditEventsTable } from '@tg-search/core'
import { H3 } from 'h3'
import { decodeJwt, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockDB } from '../../../packages/core/src/db/mock'
import { accountsTable } from '../../../packages/core/src/schemas/accounts'
import { CLI_CLIENT_ID, oauthUrls } from './auth/better-auth'
import { TELEGRAM_OIDC_ISSUER } from './auth/telegram-oidc'
import { mountOAuth } from './oauth'

const publicUrl = 'http://localhost:3000'
const telegramClientId = '123456789'
const config: OAuthConfig = {
  mode: 'oauth',
  publicUrl,
  secret: 'synthetic-better-auth-secret-'.repeat(2),
  telegram: { clientId: telegramClientId, clientSecret: 'synthetic-telegram-secret' },
  adminTelegramIds: new Set(),
}
const { resource } = oauthUrls(config)
const message = { id: '42', chatId: '7', senderId: '3', senderName: 'Test', timestamp: 1700000000, text: 'project progress', forward: { isForward: false }, media: [], links: [] }

/** Minimal cookie jar: Better Auth keeps OAuth state and the session in cookies. */
function cookieJar() {
  const cookies = new Map<string, string>()
  return {
    store(response: Response) {
      for (const header of response.headers.getSetCookie()) {
        const [pair] = header.split(';')
        const index = pair.indexOf('=')
        cookies.set(pair.slice(0, index), pair.slice(index + 1))
      }
    },
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
  }
}

/** Stands in for oauth.telegram.org: discovery, JWKS, and a token endpoint that issues signed ID tokens. */
async function fakeTelegram() {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const jwk = { ...await exportJWK(publicKey), kid: 'telegram-test', alg: 'RS256', use: 'sig' }
  const pending = new Map<string, { nonce?: string, telegramId: number }>()
  const tokenRequests: Request[] = []
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.origin !== TELEGRAM_OIDC_ISSUER)
      return realFetch(input, init)
    if (url.pathname === '/.well-known/openid-configuration') {
      return Response.json({
        issuer: TELEGRAM_OIDC_ISSUER,
        authorization_endpoint: `${TELEGRAM_OIDC_ISSUER}/auth`,
        token_endpoint: `${TELEGRAM_OIDC_ISSUER}/token`,
        jwks_uri: `${TELEGRAM_OIDC_ISSUER}/.well-known/jwks.json`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'profile', 'phone'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        claims_supported: ['sub', 'iss', 'aud', 'exp', 'iat'],
      })
    }
    if (url.pathname === '/.well-known/jwks.json')
      return Response.json({ keys: [jwk] })
    if (url.pathname === '/token') {
      tokenRequests.push(request.clone())
      const code = new URLSearchParams(await request.text()).get('code') ?? ''
      const grant = pending.get(code)
      if (!grant)
        return Response.json({ error: 'invalid_grant' }, { status: 400 })
      pending.delete(code)
      const idToken = await new SignJWT({ id: grant.telegramId, name: 'Test User', preferred_username: 'test_user', ...(grant.nonce ? { nonce: grant.nonce } : {}) })
        .setProtectedHeader({ alg: 'RS256', kid: 'telegram-test' })
        .setIssuer(TELEGRAM_OIDC_ISSUER)
        .setAudience(telegramClientId)
        .setSubject(`opaque-${grant.telegramId}`)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey)
      return Response.json({ access_token: 'telegram-access-token', token_type: 'Bearer', expires_in: 300, id_token: idToken })
    }
    return new Response(null, { status: 404 })
  })
  return {
    /** Records what Telegram would issue for the authorization request at `authorizeUrl`. */
    approve(authorizeUrl: URL, telegramId: number) {
      const code = `code-${pending.size}-${telegramId}`
      pending.set(code, { nonce: authorizeUrl.searchParams.get('nonce') ?? undefined, telegramId })
      return code
    },
    tokenRequests,
  }
}

async function fixture() {
  const db = await mockDB({ ...authSchema, accountsTable, remoteAuditEventsTable })
  const telegram = await fakeTelegram()
  const searchLocalMessages = vi.fn<TelegramApplication['searchLocalMessages']>(async () => ({ ok: true, data: { items: [message], nextCursor: null } }))
  const application = { searchLocalMessages } as unknown as RemoteApplication
  const getApplication = vi.fn((_accountId: string) => application)
  const app = new H3()
  const guard = await mountOAuth(app, { db, config, getApplication })
  const request = (path: string, init: RequestInit = {}) => app.fetch(new Request(new URL(path, publicUrl), init))

  /** Signs in through the Telegram OIDC flow and returns the session cookies. */
  async function signIn(telegramId: number) {
    const jar = cookieJar()
    const started = await request('/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': publicUrl },
      body: JSON.stringify({ provider: 'telegram', callbackURL: '/' }),
    })
    expect(started.status).toBe(200)
    jar.store(started)
    const authorizeUrl = new URL((await started.json() as { url: string }).url)
    expect(authorizeUrl.origin + authorizeUrl.pathname).toBe(`${TELEGRAM_OIDC_ISSUER}/auth`)
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256')
    const code = telegram.approve(authorizeUrl, telegramId)
    const callback = await request(`/api/auth/callback/telegram?code=${code}&state=${authorizeUrl.searchParams.get('state')}`, { headers: { cookie: jar.header() } })
    expect(callback.status).toBe(302)
    expect(callback.headers.get('location')).not.toContain('error')
    jar.store(callback)
    return jar
  }

  /** Runs the device authorization grant for the CLI client as the signed-in user. */
  async function deviceToken(jar: ReturnType<typeof cookieJar>, scope: string) {
    const form = (values: Record<string, string>) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values).toString() })
    const issued = await request('/api/auth/device/code', form({ client_id: CLI_CLIENT_ID, scope, resource }))
    expect(issued.status).toBe(200)
    const device = await issued.json() as { device_code: string, user_code: string, verification_uri: string }
    // The Web UI serves the approval page; `/login` is the Telegram MTProto login.
    expect(device.verification_uri).toBe(`${publicUrl}/auth/device`)
    const bound = await request(`/api/auth/device?user_code=${device.user_code}`, { headers: { cookie: jar.header() } })
    expect(bound.status).toBe(200)
    const approved = await request('/api/auth/device/approve', { method: 'POST', headers: { 'content-type': 'application/json', 'cookie': jar.header(), 'origin': publicUrl }, body: JSON.stringify({ userCode: device.user_code }) })
    expect(approved.status).toBe(200)
    const token = await request('/api/auth/oauth2/token', form({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: device.device_code, client_id: CLI_CLIENT_ID }))
    expect(token.status).toBe(200)
    return (await token.json() as { access_token: string }).access_token
  }

  function mcpClient(accessToken: string) {
    const client = new Client({ name: 'oauth-flow-test', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL('/mcp', publicUrl), {
      fetch: async (url, init) => app.fetch(new Request(url, init)),
      requestInit: { headers: { authorization: `Bearer ${accessToken}` } },
    })
    return { client, connect: () => client.connect(transport) }
  }

  return { db, app, telegram, request, guard, signIn, deviceToken, mcpClient, getApplication, searchLocalMessages }
}

describe('oAuth authorization, MCP, and remote API', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('publishes protected-resource metadata and challenges requests without a token', async () => {
    const f = await fixture()
    const metadata = await f.request('/.well-known/oauth-protected-resource/mcp')
    expect(metadata.status).toBe(200)
    expect(await metadata.json()).toMatchObject({ resource, authorization_servers: [`${publicUrl}/api/auth`], scopes_supported: expect.arrayContaining(['messages:read', 'chats:read']) })

    const unauthorized = await f.request('/mcp', { method: 'POST', headers: { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' }, body: '{}' })
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.headers.get('www-authenticate')).toContain('resource_metadata=')

    const remote = await f.request('/v1/remote/messages.search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(remote.status).toBe(401)
    expect(f.getApplication).not.toHaveBeenCalled()
  })

  it('signs in with Telegram, binds the Telegram ID, and authenticates Telegram with HTTP Basic', async () => {
    const f = await fixture()
    await f.signIn(987654321)
    const [user] = await f.db.select().from(authSchema.user)
    expect(user).toMatchObject({ email: 'tg-987654321@users.telegram.invalid', emailVerified: false, name: 'Test User' })
    const [account] = await f.db.select().from(authSchema.account)
    // The linked account is keyed by the Telegram user ID, not the opaque OIDC subject.
    expect(account).toMatchObject({ providerId: 'telegram', accountId: '987654321', userId: user.id })
    expect(f.telegram.tokenRequests[0]!.headers.get('authorization')).toBe(`Basic ${btoa(`${telegramClientId}:synthetic-telegram-secret`)}`)
  })

  it('issues an audience-bound JWT through the device grant and serves MCP tools for the owner account', async () => {
    const f = await fixture()
    const jar = await f.signIn(987654321)
    const accessToken = await f.deviceToken(jar, 'messages:read offline_access')
    const claims: JWTPayload = decodeJwt(accessToken)
    expect(claims).toMatchObject({ aud: resource, azp: CLI_CLIENT_ID, telegram_id: '987654321', scope: 'messages:read offline_access' })

    const account = await models.accountModels.recordAccount(f.db, 'telegram', '987654321')
    const { client, connect } = f.mcpClient(accessToken)
    await connect()
    const tools = (await client.listTools()).tools.map(tool => tool.name)
    // Only the granted scope's tools are listed: no chats, media, or database administration.
    expect(tools).toContain('messages_search')
    expect(tools).not.toContain('chats_list')
    expect(tools).not.toContain('database_indexes_drop')

    const result = await client.callTool({ name: 'messages_search', arguments: { query: 'progress' } })
    expect(result.isError).toBe(false)
    expect(result.structuredContent).toMatchObject({ items: [expect.objectContaining({ id: '42' })] })
    expect(f.getApplication).toHaveBeenCalledWith(account.id)

    const invalid = await client.callTool({ name: 'messages_search', arguments: { query: 42 } })
    expect(invalid.isError).toBe(true)
    expect(invalid.structuredContent).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })

    const audit = await f.db.select().from(remoteAuditEventsTable)
    expect(audit.map(row => [row.credential_id, row.account_id, row.method, row.decision])).toEqual([
      [CLI_CLIENT_ID, account.id, 'messages.search', 'allowed'],
      [CLI_CLIENT_ID, account.id, 'messages.search', 'denied'],
    ])
    await client.close()

    const remote = await f.request('/v1/remote/messages.search', { method: 'POST', headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: 'progress' }) })
    expect(remote.status).toBe(200)
    const denied = await f.request('/v1/remote/chats.list', { method: 'POST', headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: '{}' })
    expect(denied.status).toBe(403)
  })

  it('hides internal failures from MCP clients', async () => {
    const f = await fixture()
    const jar = await f.signIn(987654321)
    const accessToken = await f.deviceToken(jar, 'messages:read')
    await models.accountModels.recordAccount(f.db, 'telegram', '987654321')
    // The SDK forwards a thrown error's message; a database error can carry SQL and account IDs.
    f.searchLocalMessages.mockRejectedValueOnce(new Error('select * from chat_messages where account_id = $1'))
    const { client, connect } = f.mcpClient(accessToken)
    await connect()
    const result = await client.callTool({ name: 'messages_search', arguments: { query: 'progress' } })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } })
    expect(JSON.stringify(result)).not.toContain('chat_messages')
    await client.close()
  })

  it('keeps device login working after TGS_PUBLIC_URL changes', async () => {
    // The CLI client's resource link used one fixed row; after a URL change it pointed at the old resource
    // and every device login failed with invalid_target.
    const f = await fixture()
    const movedUrl = 'http://localhost:3001'
    const moved = { ...config, publicUrl: movedUrl }
    const app = new H3()
    await mountOAuth(app, { db: f.db, config: moved, getApplication: f.getApplication })
    const issued = await app.fetch(new Request(`${movedUrl}/api/auth/device/code`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLI_CLIENT_ID, scope: 'messages:read', resource: oauthUrls(moved).resource }).toString(),
    }))
    expect(issued.status).toBe(200)
  })

  it('refuses a token whose Telegram user has not connected an account on this server', async () => {
    const f = await fixture()
    const jar = await f.signIn(111111111)
    const accessToken = await f.deviceToken(jar, 'messages:read')
    // Another user's account exists; the tenancy rule must not fall back to it.
    await models.accountModels.recordAccount(f.db, 'telegram', '987654321')
    const response = await f.request('/v1/remote/messages.search', { method: 'POST', headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: '{}' })
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'TELEGRAM_NOT_CONNECTED' } })
    expect(f.getApplication).not.toHaveBeenCalled()
  })

  it('drops database administration from a non-administrator token', async () => {
    const f = await fixture()
    const jar = await f.signIn(987654321)
    const accessToken = await f.deviceToken(jar, 'messages:read database:admin')
    await models.accountModels.recordAccount(f.db, 'telegram', '987654321')
    const response = await f.request('/v1/remote/database.vector.get', { method: 'POST', headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: '{}' })
    expect(response.status).toBe(403)
  })

  it('requires a session for Web media routes and binds WebSocket sessions to their first user', async () => {
    const f = await fixture()
    const guard = f.guard.requireSession(['/v1/photos/'])
    const app = new H3().use(guard).get('/v1/photos/:id', () => 'photo')
    expect((await app.fetch(new Request(`${publicUrl}/v1/photos/1`))).status).toBe(401)

    const alice = await f.signIn(987654321)
    const bob = await f.signIn(222222222)
    const photo = await app.fetch(new Request(`${publicUrl}/v1/photos/1`, { headers: { cookie: alice.header() } }))
    expect(photo.status).toBe(200)

    const ws = (jar?: ReturnType<typeof cookieJar>) => new Request(`${publicUrl}/ws?sessionId=s1`, { headers: jar ? { cookie: jar.header() } : {} })
    // crossws only honors a thrown Response; an HTTPError made the rejected upgrade a 500.
    await expect(f.guard.authorizeWebSocket(ws(), 's1')).rejects.toBeInstanceOf(Response)
    await expect(f.guard.authorizeWebSocket(ws(), 's1')).rejects.toMatchObject({ status: 401 })
    await f.guard.authorizeWebSocket(ws(alice), 's1')
    await f.guard.authorizeWebSocket(ws(alice), 's1')
    await expect(f.guard.authorizeWebSocket(ws(bob), 's1')).rejects.toMatchObject({ status: 403 })

    // A page on another origin (for example a sibling subdomain) carries the cookie but not the server's Origin.
    const crossOrigin = new Request(`${publicUrl}/ws?sessionId=s1`, { headers: { cookie: alice.header(), origin: 'https://evil.localhost:3000' } })
    await expect(f.guard.authorizeWebSocket(crossOrigin, 's1')).rejects.toMatchObject({ status: 403 })
    const sameOrigin = new Request(`${publicUrl}/ws?sessionId=s1`, { headers: { cookie: alice.header(), origin: publicUrl } })
    await f.guard.authorizeWebSocket(sameOrigin, 's1')
  })
})
