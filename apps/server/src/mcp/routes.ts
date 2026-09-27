import type { TelegramApplication } from '@tg-search/core'
import type { H3 } from 'h3'

import type { McpConfig } from './auth'

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { assertBodySize } from 'h3'

import { createMcpTokenVerifier, MCP_SCOPE } from './auth'
import { createTelegramMcpServer } from './tools'

export function setupMcpRoutes(app: H3, config: McpConfig, getApplication: (accountId: string) => TelegramApplication, verifyToken = createMcpTokenVerifier(config)) {
  const resourceUrl = new URL(config.resource)
  const metadataUrl = `${resourceUrl.origin}/.well-known/oauth-protected-resource/mcp`
  const metadata = () => Response.json({
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
  })
  app.get('/.well-known/oauth-protected-resource/mcp', metadata)
  app.get('/.well-known/oauth-protected-resource', metadata)
  app.all('/mcp', async (event) => {
    const origin = event.req.headers.get('origin')
    if (origin && origin !== resourceUrl.origin)
      return new Response(null, { status: 403 })
    const authorization = event.req.headers.get('authorization')
    let accountId: string
    try {
      if (!authorization?.startsWith('Bearer '))
        throw new Error('Missing bearer token')
      accountId = await verifyToken(authorization.slice(7))
    }
    catch {
      return new Response(null, {
        status: 401,
        headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}", scope="${MCP_SCOPE}"`, 'Cache-Control': 'no-store' },
      })
    }
    if (event.req.method !== 'POST')
      return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    assertBodySize(event, 65_536)
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    const server = createTelegramMcpServer(getApplication(accountId), config.webUrl)
    try {
      await server.connect(transport)
      const response = await transport.handleRequest(event.req)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
    finally {
      await server.close()
    }
  })
}
