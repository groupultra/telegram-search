import type { CallToolResult, StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import type { RemoteMethod } from '@tg-search/protocol'
import type { GenericSchema } from 'valibot'

import type { ClaimsVerifier, createPrincipalResolver } from '../auth/principal'
import type { RemoteExecutor, RemotePrincipal } from '../remote/executor'

import { randomUUID } from 'node:crypto'

import { createMcpHandler, McpServer, originValidationResponse } from '@modelcontextprotocol/server'
import { remoteMethods } from '@tg-search/protocol'
import { toJsonSchema } from '@valibot/to-json-schema'

import pkg from '../../package.json' with { type: 'json' }

const toolDescriptions: Record<RemoteMethod, { description: string, readOnly: boolean }> = {
  'chats.list': { description: 'List the chats of the connected Telegram account.', readOnly: true },
  'messages.get': { description: 'Get specific messages of one chat by message ID.', readOnly: true },
  'messages.replies': { description: 'Resolve reply chains around messages of one chat.', readOnly: true },
  'messages.read': { description: 'Read a window of message history of one chat from Telegram or the local index.', readOnly: true },
  'messages.list': { description: 'List recent messages of one chat from Telegram.', readOnly: true },
  'messages.query': { description: 'Filter indexed messages by chat, sender, and time range.', readOnly: true },
  'messages.search': { description: 'Search indexed messages by text, optionally with vector similarity.', readOnly: true },
  'messages.context': { description: 'Get the indexed messages around one message.', readOnly: true },
  'stats.get': { description: 'Count indexed messages grouped by chat or time bucket.', readOnly: true },
  'media.read': { description: 'Read a chunk of one message attachment as base64.', readOnly: true },
  'media.createLink': { description: 'Create a five-minute download link for one message attachment.', readOnly: true },
  'database.indexes.list': { description: 'List the server database search indexes.', readOnly: true },
  'database.indexes.drop': { description: 'Drop server database search indexes.', readOnly: false },
  'database.indexes.rebuild': { description: 'Rebuild server database search indexes.', readOnly: false },
  'database.vector.get': { description: 'Show whether vector search is enabled on the server.', readOnly: true },
  'database.vector.set': { description: 'Enable or disable vector search on the server.', readOnly: false },
}

export function toolName(method: RemoteMethod): string {
  return method.replaceAll('.', '_')
}

/**
 * Advertises the method's JSON Schema without validating. The remote executor
 * validates with the Valibot schema, so MCP and REST reject the same input and
 * every rejection is audited once.
 */
function advertisedSchema(schema: GenericSchema): StandardSchemaWithJSON<unknown, unknown> {
  const json = toJsonSchema(schema, { errorMode: 'ignore', typeMode: 'input' }) as Record<string, unknown>
  return {
    '~standard': {
      version: 1,
      vendor: 'tg-search',
      jsonSchema: { input: () => json, output: () => json },
      validate: value => ({ value }),
    },
  }
}

const inputSchemas = new Map((Object.keys(remoteMethods) as RemoteMethod[]).map(method => [method, advertisedSchema(remoteMethods[method].input)]))

function toolResult(value: unknown, isError: boolean): CallToolResult {
  const structured = (typeof value === 'object' && value !== null ? value : { value }) as Record<string, unknown>
  return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: structured, isError }
}

/** Builds the MCP server for one principal; it lists only the tools its scopes allow. */
export function createMcpServerForPrincipal(principal: RemotePrincipal, executor: RemoteExecutor): McpServer {
  const server = new McpServer({ name: 'telegram-search', version: pkg.version })
  for (const method of Object.keys(remoteMethods) as RemoteMethod[]) {
    if (!principal.capabilities.has(method))
      continue
    const { description, readOnly } = toolDescriptions[method]
    server.registerTool(toolName(method), {
      description,
      inputSchema: inputSchemas.get(method),
      annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: false },
    }, async (args: unknown, ctx) => {
      let execution: Awaited<ReturnType<RemoteExecutor['execute']>>
      try {
        execution = await executor.execute(principal, method, {
          requestId: randomUUID(),
          signal: ctx.mcpReq.signal,
          userAgent: 'mcp',
          readInput: async () => args ?? {},
        })
      }
      catch {
        // The SDK would send the error message to the client; database errors can carry SQL and IDs.
        return toolResult({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Remote request failed', retryable: false } }, true)
      }
      if (execution.kind === 'rejected')
        return toolResult({ ok: false, error: { code: execution.code, message: execution.message, retryable: false } }, true)
      const result = execution.result as { ok?: boolean, data?: unknown }
      return result.ok ? toolResult(result.data, false) : toolResult(result, true)
    })
  }
  return server
}

export interface McpEndpointOptions {
  publicUrl: string
  verify: ClaimsVerifier
  resolvePrincipal: ReturnType<typeof createPrincipalResolver>
  executor: RemoteExecutor
}

function jsonRpcError(status: number, code: string, message: string): Response {
  return Response.json({ jsonrpc: '2.0', error: { code: -32000, message, data: { code } }, id: null }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Streamable HTTP MCP endpoint protected by OAuth access tokens. */
export function createMcpEndpoint(options: McpEndpointOptions): (request: Request) => Promise<Response> {
  const hostname = new URL(options.publicUrl).hostname
  const principals = new WeakMap<object, RemotePrincipal>()
  const handler = createMcpHandler((ctx) => {
    const principal = ctx.authInfo?.extra && principals.get(ctx.authInfo.extra)
    if (!principal)
      throw new Error('MCP request reached the server without a verified principal')
    return createMcpServerForPrincipal(principal, options.executor)
  })

  return async (request) => {
    // The SDK entry is validation-free; reject DNS-rebinding and cross-origin browser requests first.
    // The server derives the request URL from the Host header, so its hostname is the requested host.
    if (new URL(request.url).hostname !== hostname)
      return jsonRpcError(403, 'INVALID_HOST', 'Invalid Host header')
    const rejected = originValidationResponse(request, [hostname])
    if (rejected)
      return rejected
    const verified = await options.verify(request)
    if ('response' in verified)
      return verified.response
    const resolution = await options.resolvePrincipal(verified.claims)
    if ('error' in resolution)
      return jsonRpcError(resolution.error.status, resolution.error.code, resolution.error.message)
    const { principal } = resolution
    const extra = {}
    principals.set(extra, principal)
    const scope = verified.claims.scope
    return handler.fetch(request, {
      authInfo: {
        token: request.headers.get('authorization')?.slice('Bearer '.length) ?? '',
        clientId: principal.clientId,
        scopes: typeof scope === 'string' ? scope.split(' ').filter(Boolean) : [],
        expiresAt: verified.claims.exp,
        extra,
      },
    })
  }
}
