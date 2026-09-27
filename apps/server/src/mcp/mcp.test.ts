import type { TelegramApplication } from '@tg-search/core'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { H3, serve } from 'h3'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it, vi } from 'vitest'

import { createMcpTokenVerifier, mcpConfigFromEnv } from './auth'
import { setupMcpRoutes } from './routes'

const config = {
  resource: 'https://tgs.example.com/mcp',
  issuer: 'https://identity.example.com/',
  jwksUrl: 'https://identity.example.com/jwks',
  subject: 'test-user',
  accountId: '11111111-1111-4111-8111-111111111111',
  webUrl: 'https://tgs-web.example.com',
}

async function tokens() {
  const { privateKey, publicKey } = await generateKeyPair('ES256')
  const getKey = createLocalJWKSet({ keys: [await exportJWK(publicKey)] })
  const verify = createMcpTokenVerifier(config, getKey)
  const sign = (claims: Record<string, unknown> = {}) => new SignJWT({
    iss: config.issuer,
    aud: config.resource,
    sub: config.subject,
    scope: 'telegram:read',
    exp: Math.floor(Date.now() / 1000) + 600,
    ...claims,
  }).setProtectedHeader({ alg: 'ES256' }).sign(privateKey)
  return { verify, sign }
}

function fixture() {
  const message = { id: '42', chatId: '7', senderId: '3', senderName: 'Test', timestamp: 1700000000, text: 'Project progress', forward: { isForward: false }, media: [], links: [] }
  const application = {
    listChats: vi.fn<TelegramApplication['listChats']>(),
    listRemoteMessages: vi.fn<TelegramApplication['listRemoteMessages']>(),
    queryLocalMessages: vi.fn<TelegramApplication['queryLocalMessages']>(),
    searchLocalMessages: vi.fn<TelegramApplication['searchLocalMessages']>(async () => ({ ok: true, data: { items: [message], nextCursor: '20' } })),
    getLocalMessageContext: vi.fn<TelegramApplication['getLocalMessageContext']>(async () => ({ ok: true, data: { messages: [message], targetIndex: 0 } })),
    getLocalStats: vi.fn<TelegramApplication['getLocalStats']>(),
    async* sync() {},
  } satisfies TelegramApplication
  return { application, resolve: vi.fn<(accountId: string) => TelegramApplication>(() => application) }
}

describe('telegram MCP OAuth', () => {
  it('validates signatures, issuer, resource, subject, expiry and scope', async () => {
    const { verify, sign } = await tokens()
    expect(await verify(await sign())).toBe(config.accountId)
    for (const claims of [
      { iss: 'https://untrusted.example.com' },
      { aud: 'https://another-resource.example.com' },
      { sub: 'another-user' },
      { exp: 1 },
      { exp: undefined },
      { scope: 'unrelated:read' },
    ]) {
      await expect(verify(await sign(claims))).rejects.toThrow()
    }
    const stranger = await tokens()
    await expect(verify(await stranger.sign())).rejects.toThrow()
  })

  it('is disabled by default and rejects partial configuration', () => {
    expect(mcpConfigFromEnv({})).toBeUndefined()
    expect(() => mcpConfigFromEnv({ TG_SEARCH_MCP_RESOURCE_URL: config.resource })).toThrow('ISSUER')
    expect(mcpConfigFromEnv({
      TG_SEARCH_MCP_RESOURCE_URL: config.resource,
      TG_SEARCH_MCP_ISSUER: config.issuer,
      TG_SEARCH_MCP_JWKS_URL: config.jwksUrl,
      TG_SEARCH_MCP_SUBJECT: config.subject,
      TG_SEARCH_MCP_ACCOUNT_ID: config.accountId,
      TG_SEARCH_MCP_WEB_URL: config.webUrl,
    })).toEqual(config)
  })

  it('advertises OAuth discovery and rejects unauthorized calls before resolving data', async () => {
    const { verify, sign } = await tokens()
    const { resolve } = fixture()
    const app = new H3()
    setupMcpRoutes(app, config, resolve, verify)
    const metadata = await app.request('/.well-known/oauth-protected-resource/mcp')
    expect(await metadata.json()).toMatchObject({ resource: config.resource, authorization_servers: [config.issuer], scopes_supported: ['telegram:read'] })
    const anonymous = await app.request('/mcp', { method: 'POST' })
    expect(anonymous.status).toBe(401)
    expect(anonymous.headers.get('www-authenticate')).toContain('/.well-known/oauth-protected-resource/mcp')
    const expired = await app.request('/mcp', { method: 'POST', headers: { authorization: `Bearer ${await sign({ exp: 1 })}` } })
    expect(expired.status).toBe(401)
    const crossOrigin = await app.request('/mcp', { method: 'POST', headers: { origin: 'https://untrusted.example.com', authorization: `Bearer ${await sign()}` } })
    expect(crossOrigin.status).toBe(403)
    expect(resolve).not.toHaveBeenCalled()
  })
})

describe('telegram MCP over Streamable HTTP', () => {
  it('initializes and searches, paginates and fetches through the real MCP client', async () => {
    const { verify, sign } = await tokens()
    const { resolve, application } = fixture()
    const app = new H3()
    setupMcpRoutes(app, config, resolve, verify)
    const server = serve(app, { hostname: '127.0.0.1', port: 0, silent: true })
    await server.ready()
    const client = new Client({ name: 'integration-test', version: '1.0.0' })
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', server.url!), {
        requestInit: { headers: { Authorization: `Bearer ${await sign()}` } },
      }))
      const tools = await client.listTools()
      expect(tools.tools.map(tool => tool.name)).toEqual(['search', 'search_messages', 'fetch'])
      expect(tools.tools.every(tool => tool.annotations?.readOnlyHint === true)).toBe(true)
      const search = await client.callTool({ name: 'search', arguments: { query: 'project' } })
      expect(search.structuredContent).toMatchObject({ results: [{ id: '7:42', url: 'https://tgs-web.example.com/chat/7?messageId=42' }] })
      expect(search.isError).not.toBe(true)
      const filtered = await client.callTool({ name: 'search_messages', arguments: { query: 'project', chat_ids: ['7'], cursor: '20', limit: 5 } })
      expect(filtered.structuredContent).toMatchObject({ next_cursor: '20', coverage: 'indexed_messages_only' })
      expect(application.searchLocalMessages).toHaveBeenLastCalledWith({ query: 'project', chatIds: ['7'], cursor: '20', limit: 5, useVector: false })
      const fetched = await client.callTool({ name: 'fetch', arguments: { id: '7:42' } })
      expect(fetched.structuredContent).toMatchObject({ id: '7:42', text: '[2023-11-14T22:13:20.000Z] Test: Project progress' })
      expect(application.getLocalMessageContext).toHaveBeenCalledWith({ chatId: '7', messageId: '42', before: 10, after: 10 })
      expect(resolve.mock.calls.every(([accountId]) => accountId === config.accountId)).toBe(true)
      const invalid = await client.callTool({ name: 'fetch', arguments: { id: '../../other-account' } })
      expect(invalid.isError).toBe(true)
      application.getLocalMessageContext.mockResolvedValueOnce({ ok: true, data: { messages: [], targetIndex: -1 } })
      expect((await client.callTool({ name: 'fetch', arguments: { id: '7:999' } })).isError).toBe(true)
      application.searchLocalMessages.mockResolvedValueOnce({ ok: false, error: { code: 'INTERNAL', message: 'private database details', retryable: false } })
      const failed = await client.callTool({ name: 'search', arguments: { query: 'project' } })
      expect(failed.isError).toBe(true)
      expect(JSON.stringify(failed)).not.toContain('private database details')
    }
    finally {
      await client.close()
      await server.close()
    }
  })
})
