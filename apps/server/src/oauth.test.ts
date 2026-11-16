import type { TelegramApplication } from '@tg-search/core'
import type { JWTPayload } from 'jose'

import type { OAuthConfig } from './auth/better-auth'
import type { RemoteApplication } from './remote/application'

import { createHash } from 'node:crypto'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { authSchema, models, remoteAuditEventsTable } from '@tg-search/core'
import { H3 } from 'h3'
import { decodeJwt } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockDB } from '../../../packages/core/src/db/mock'
import { accountsTable } from '../../../packages/core/src/schemas/accounts'
import { CLI_CLIENT_ID, oauthUrls } from './auth/better-auth'
import { mountOAuth } from './oauth'

const publicUrl = 'http://localhost:3000'
const config: OAuthConfig = {
  mode: 'oauth',
  publicUrl,
  secret: 'synthetic-better-auth-secret-'.repeat(2),
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

async function fixture() {
  const db = await mockDB({ ...authSchema, accountsTable, remoteAuditEventsTable })
  const searchLocalMessages = vi.fn<TelegramApplication['searchLocalMessages']>(async () => ({ ok: true, data: { items: [message], nextCursor: null } }))
  const application = { searchLocalMessages } as unknown as RemoteApplication
  const getApplication = vi.fn((_accountId: string) => application)
  const app = new H3()
  const { guard, issueSignInTicket } = await mountOAuth(app, { db, config, getApplication })
  const request = (path: string, init: RequestInit = {}) => app.fetch(new Request(new URL(path, publicUrl), init))

  /** Exchanges a sign-in ticket, as the Web UI does after its MTProto login, and returns the session cookies. */
  async function exchange(ticket: string, oauthQuery?: string) {
    return request('/api/auth/sign-in/telegram-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': publicUrl },
      body: JSON.stringify({ ticket, ...(oauthQuery ? { oauth_query: oauthQuery } : {}) }),
    })
  }

  async function signIn(telegramId: number, oauthQuery?: string) {
    const jar = cookieJar()
    const response = await exchange(await issueSignInTicket({ telegramId: String(telegramId), name: 'Test User' }), oauthQuery)
    expect(response.status).toBe(200)
    jar.store(response)
    return { jar, body: await response.json() as { userId?: string, redirect?: boolean, url?: string } }
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

  return { db, app, request, guard, issueSignInTicket, exchange, signIn, deviceToken, mcpClient, getApplication, searchLocalMessages }
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
    // ChatGPT requested every listed scope; listing `database:admin`, which self-registered clients may not
    // hold, failed its authorization with invalid_scope before the sign-in page.
    expect(await metadata.json()).toMatchObject({ resource, authorization_servers: [`${publicUrl}/api/auth`], scopes_supported: ['chats:read', 'messages:read', 'media:read'] })
    const serverMetadata = await (await f.request('/.well-known/oauth-authorization-server/api/auth')).json() as { scopes_supported: string[] }
    expect(serverMetadata.scopes_supported).not.toContain('database:admin')

    const unauthorized = await f.request('/mcp', { method: 'POST', headers: { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' }, body: '{}' })
    expect(unauthorized.status).toBe(401)
    expect(unauthorized.headers.get('www-authenticate')).toContain('resource_metadata=')

    const remote = await f.request('/v1/remote/messages.search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(remote.status).toBe(401)
    expect(f.getApplication).not.toHaveBeenCalled()
  })

  it('signs in with a ticket from the MTProto login and keys the account by the Telegram ID', async () => {
    const f = await fixture()
    const first = await f.signIn(987654321)
    const [user] = await f.db.select().from(authSchema.user)
    expect(user).toMatchObject({ id: first.body.userId, email: 'tg-987654321@users.telegram.invalid', emailVerified: false, name: 'Test User' })
    const [account] = await f.db.select().from(authSchema.account)
    expect(account).toMatchObject({ providerId: 'telegram', accountId: '987654321', userId: user.id })
    expect(first.jar.header()).toContain('session_token')
    expect(await (await f.request('/api/auth/get-session', { headers: { cookie: first.jar.header() } })).json()).toMatchObject({ user: { id: user.id } })

    // A later login of the same Telegram account signs in to the same user.
    const second = await f.signIn(987654321)
    expect(second.body.userId).toBe(user.id)
    expect(await f.db.select().from(authSchema.user)).toHaveLength(1)
  })

  it('accepts each ticket once and rejects forged or expired tickets', async () => {
    const f = await fixture()
    const ticket = await f.issueSignInTicket({ telegramId: '987654321' })
    expect((await f.exchange(ticket)).status).toBe(200)
    // A replayed ticket would let anyone who saw it sign in as that Telegram user.
    expect((await f.exchange(ticket)).status).toBe(401)
    expect((await f.exchange('A'.repeat(43))).status).toBe(401)

    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const stale = await f.issueSignInTicket({ telegramId: '987654321' })
      vi.setSystemTime(Date.now() + 121_000)
      expect((await f.exchange(stale)).status).toBe(401)
    }
    finally {
      vi.useRealTimers()
    }
    // Only a hash of the ticket is stored, so a database reader cannot replay it.
    const rows = await f.db.select().from(authSchema.verification)
    expect(rows.every(row => !row.identifier.includes(ticket))).toBe(true)
  })

  it('resumes an MCP client authorization after sign-in and issues a token through consent', async () => {
    const f = await fixture()
    // A public client like ChatGPT, registered directly instead of through a metadata document.
    const now = new Date()
    await f.db.insert(authSchema.oauthClient).values({ id: 'chat-client', clientId: 'chat-client', name: 'Chat Client', redirectUris: ['https://client.example/callback'], tokenEndpointAuthMethod: 'none', grantTypes: ['authorization_code', 'refresh_token'], responseTypes: ['code'], scopes: ['offline_access', 'messages:read'], createdAt: now, updatedAt: now })
    await f.db.insert(authSchema.oauthClientResource).values({ id: 'chat-client:mcp', clientId: 'chat-client', resourceId: resource, createdAt: now })
    const verifier = 'v'.repeat(64)
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const authorize = new URLSearchParams({ response_type: 'code', client_id: 'chat-client', redirect_uri: 'https://client.example/callback', scope: 'messages:read', state: 'client-state', code_challenge: challenge, code_challenge_method: 'S256', resource })

    const toSignIn = await f.request(`/api/auth/oauth2/authorize?${authorize}`)
    expect(toSignIn.status).toBe(302)
    const signInUrl = new URL(toSignIn.headers.get('location')!, publicUrl)
    expect(signInUrl.pathname).toBe('/auth/sign-in')

    // The provider resumes the authorization request once the ticket sign-in sets the session cookie.
    const { jar, body } = await f.signIn(987654321, signInUrl.search.slice(1))
    expect(body.redirect).toBe(true)
    const consentUrl = new URL(body.url!, publicUrl)
    expect(consentUrl.pathname).toBe('/auth/consent')

    const consent = await f.request('/api/auth/oauth2/consent', { method: 'POST', headers: { 'content-type': 'application/json', 'cookie': jar.header(), 'origin': publicUrl }, body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }) })
    expect(consent.status).toBe(200)
    const callback = new URL((await consent.json() as { url: string }).url)
    expect(callback.origin + callback.pathname).toBe('https://client.example/callback')
    expect(callback.searchParams.get('state')).toBe('client-state')

    // A tampered authorization request fails the provider's signature check before the ticket is spent.
    const forged = signInUrl.search.slice(1).replace('scope=messages%3Aread', 'scope=database%3Aadmin')
    const ticket = await f.issueSignInTicket({ telegramId: '987654321' })
    expect((await f.exchange(ticket, forged)).status).toBe(400)
    expect((await f.exchange(ticket)).status).toBe(200)

    const token = await f.request('/api/auth/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: callback.searchParams.get('code')!, redirect_uri: 'https://client.example/callback', client_id: 'chat-client', code_verifier: verifier, resource }).toString() })
    expect(token.status).toBe(200)
    expect(decodeJwt((await token.json() as { access_token: string }).access_token)).toMatchObject({ aud: resource, azp: 'chat-client', telegram_id: '987654321' })
  })

  it('issues an audience-bound JWT through the device grant and serves MCP tools for the owner account', async () => {
    const f = await fixture()
    const { jar } = await f.signIn(987654321)
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
    const { jar } = await f.signIn(987654321)
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
    const { jar } = await f.signIn(111111111)
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
    const { jar } = await f.signIn(987654321)
    const accessToken = await f.deviceToken(jar, 'messages:read database:admin')
    await models.accountModels.recordAccount(f.db, 'telegram', '987654321')
    const response = await f.request('/v1/remote/database.vector.get', { method: 'POST', headers: { 'authorization': `Bearer ${accessToken}`, 'content-type': 'application/json' }, body: '{}' })
    expect(response.status).toBe(403)
  })

  it('requires a session for Web media routes and keeps the WebSocket open for the Telegram login', async () => {
    const f = await fixture()
    const guard = f.guard.requireSession(['/v1/photos/'])
    const app = new H3().use(guard).get('/v1/photos/:id', () => 'photo')
    expect((await app.fetch(new Request(`${publicUrl}/v1/photos/1`))).status).toBe(401)

    const { jar: alice } = await f.signIn(987654321)
    const photo = await app.fetch(new Request(`${publicUrl}/v1/photos/1`, { headers: { cookie: alice.header() } }))
    expect(photo.status).toBe(200)

    // Signing in happens over the WebSocket, so a signed-out browser must be able to open it.
    await f.guard.authorizeWebSocket(new Request(`${publicUrl}/ws?sessionId=s1`))
    await f.guard.authorizeWebSocket(new Request(`${publicUrl}/ws?sessionId=s1`, { headers: { origin: publicUrl } }))
    // A page on another origin must not drive a user's Telegram runtime; crossws only honors a thrown Response.
    const crossOrigin = f.guard.authorizeWebSocket(new Request(`${publicUrl}/ws?sessionId=s1`, { headers: { origin: 'https://evil.localhost:3000' } }))
    await expect(crossOrigin).rejects.toBeInstanceOf(Response)
    await expect(f.guard.authorizeWebSocket(new Request(`${publicUrl}/ws?sessionId=s1`, { headers: { origin: 'https://evil.localhost:3000' } }))).rejects.toMatchObject({ status: 403 })
  })
})
