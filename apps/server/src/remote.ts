import type { ReadOperationOptions } from '@tg-search/core'
import type { RemoteMethod } from '@tg-search/protocol'
import type { GenericSchema, InferOutput } from 'valibot'

import type { RemoteApplication } from './remote-application'
import type { RemoteMediaLinks } from './remote-media-links'

import { createHash, randomUUID } from 'node:crypto'

import { remoteMethods } from '@tg-search/protocol'
import { assertBodySize, H3, HTTPError, readBody, setResponseHeader } from 'h3'
import { safeParse } from 'valibot'

const remoteMethodNames = Object.keys(remoteMethods) as [RemoteMethod, ...RemoteMethod[]]

/**
 * The caller of one remote request, resolved from a verified OAuth access
 * token. Request input can never choose the account.
 */
export interface RemotePrincipal {
  /** OAuth client ID (token `azp`); recorded as the audit principal. */
  clientId: string
  clientName: string
  /** Authorization-server user ID (token `sub`). */
  userId: string
  accountId: string
  capabilities: ReadonlySet<RemoteMethod>
  /** Undefined when the principal may read every chat of its account. */
  readableChatIds?: readonly string[]
}

export type RemoteAuthentication = { principal: RemotePrincipal } | { response: Response }

/** Verifies the request credentials; returns the challenge response when they are missing or invalid. */
export type RemoteAuthenticator = (request: Request) => Promise<RemoteAuthentication>

export interface RemoteAuditEvent {
  requestId: string
  credentialId: string
  credentialName: string
  userId: string
  accountId: string
  method: string
  chatIds: string[]
  decision: 'allowed' | 'denied'
  outcome: 'success' | 'failure'
  errorCode?: string
  requestSummary: Record<string, unknown>
  resultSummary: Record<string, unknown>
  durationMs: number
  userAgent?: string
}

class RemotePermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RemotePermissionError'
  }
}

class RemoteScopeViolationError extends Error {
  constructor() {
    super('Remote application returned data outside the authorized chat scope')
    this.name = 'RemoteScopeViolationError'
  }
}

function requireCapability(principal: RemotePrincipal, method: RemoteMethod): void {
  if (!principal.capabilities.has(method))
    throw new RemotePermissionError('This credential cannot use the requested feature')
}

function scopeChatIds(principal: RemotePrincipal, requested?: string[]): string[] | undefined {
  if (principal.readableChatIds === undefined)
    return requested
  if (principal.readableChatIds.length === 0)
    throw new RemotePermissionError('This credential cannot read any chats')
  if (!requested?.length)
    return [...principal.readableChatIds]
  const allowed = new Set(principal.readableChatIds)
  if (requested.some(chatId => !allowed.has(chatId)))
    throw new RemotePermissionError('This credential cannot read one or more requested chats')
  return requested
}

function requireReadableChat(principal: RemotePrincipal, chatId: string): void {
  if (principal.readableChatIds !== undefined && !principal.readableChatIds.includes(chatId))
    throw new RemotePermissionError('This credential cannot read the requested chat')
}

interface RemoteMethodHandler {
  input: GenericSchema
  scope: (principal: RemotePrincipal, input: unknown) => Record<string, unknown>
  invoke: (application: RemoteApplication, principal: RemotePrincipal, input: Record<string, unknown>, options: ReadOperationOptions) => Promise<unknown>
  resultChatIds: (input: Record<string, unknown>, data: Record<string, unknown>) => Array<string | undefined> | undefined
}

type HandlerInput<Schema extends GenericSchema> = InferOutput<Schema> & Record<string, unknown>

function defineRemoteHandler<Schema extends GenericSchema>(definition: {
  input: Schema
  scope: (principal: RemotePrincipal, input: HandlerInput<Schema>) => HandlerInput<Schema>
  invoke: (application: RemoteApplication, principal: RemotePrincipal, input: HandlerInput<Schema>, options: ReadOperationOptions) => Promise<unknown>
  resultChatIds: (input: HandlerInput<Schema>, data: Record<string, unknown>) => Array<string | undefined> | undefined
}): RemoteMethodHandler {
  return {
    input: definition.input,
    scope: (principal, input) => definition.scope(principal, input as HandlerInput<Schema>),
    invoke: (application, principal, input, options) => definition.invoke(application, principal, input as HandlerInput<Schema>, options),
    resultChatIds: (input, data) => definition.resultChatIds(input as HandlerInput<Schema>, data),
  }
}

function scopeMultipleChats<Input extends { chatIds?: string[] } & Record<string, unknown>>(principal: RemotePrincipal, input: Input): Input {
  const chatIds = scopeChatIds(principal, input.chatIds)
  return chatIds === undefined ? input : { ...input, chatIds }
}

function scopeSingleChat<Input extends { chatId: string } & Record<string, unknown>>(principal: RemotePrincipal, input: Input): Input {
  requireReadableChat(principal, input.chatId)
  return input
}

// Database administration is not chat-scoped, so a credential limited to some chats must not reach it.
function requireAllChatAccess<Input extends Record<string, unknown>>(principal: RemotePrincipal, input: Input): Input {
  if (principal.readableChatIds !== undefined)
    throw new RemotePermissionError('Database administration requires a credential that can read all chats')
  return input
}

function itemChatIds(data: Record<string, unknown>): Array<string | undefined> | undefined {
  return (data.items as Array<{ chatId?: string }> | undefined)?.map(item => item.chatId)
}

const remoteHandlers = {
  'media.createLink': defineRemoteHandler({
    input: remoteMethods['media.createLink'].input,
    scope: scopeSingleChat,
    invoke: () => Promise.reject(new Error('Media link handler was not initialized')),
    resultChatIds: input => [input.chatId as string | undefined],
  }),
  'media.read': defineRemoteHandler({
    input: remoteMethods['media.read'].input,
    scope: scopeSingleChat,
    invoke: (application, _principal, input, options) => application.readMessageMedia(input, options),
    resultChatIds: (_input, data) => [data.chatId as string | undefined],
  }),
  'chats.list': defineRemoteHandler({
    input: remoteMethods['chats.list'].input,
    scope: (principal, input) => {
      scopeChatIds(principal)
      return input
    },
    invoke: (application, principal, input, options) => principal.readableChatIds === undefined
      ? application.listChats(input, options)
      : application.listStoredChats(input, [...principal.readableChatIds], options),
    resultChatIds: (_input, data) => (data.items as Array<{ id?: string }> | undefined)?.map(item => item.id),
  }),
  'messages.get': defineRemoteHandler({
    input: remoteMethods['messages.get'].input,
    scope: scopeSingleChat,
    invoke: (application, _principal, input, options) => application.getMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.replies': defineRemoteHandler({
    input: remoteMethods['messages.replies'].input,
    scope: scopeSingleChat,
    invoke: (application, _principal, input, options) => application.getReplyContext(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.read': defineRemoteHandler({
    input: remoteMethods['messages.read'].input,
    scope: scopeSingleChat,
    invoke: (application, _principal, input, options) => application.readMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.list': defineRemoteHandler({
    input: remoteMethods['messages.list'].input,
    scope: scopeSingleChat,
    invoke: (application, _principal, input, options) => application.listRemoteMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.query': defineRemoteHandler({
    input: remoteMethods['messages.query'].input,
    scope: scopeMultipleChats,
    invoke: (application, _principal, input, options) => application.queryLocalMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.search': defineRemoteHandler({
    input: remoteMethods['messages.search'].input,
    scope: scopeMultipleChats,
    invoke: (application, _principal, input, options) => application.searchLocalMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.context': defineRemoteHandler({
    input: remoteMethods['messages.context'].input,
    scope: scopeSingleChat,
    invoke: (application, _principal, input, options) => application.getLocalMessageContext(input, options),
    resultChatIds: (_input, data) => (data.messages as Array<{ chatId?: string }> | undefined)?.map(item => item.chatId),
  }),
  'stats.get': defineRemoteHandler({
    input: remoteMethods['stats.get'].input,
    scope: scopeMultipleChats,
    invoke: (application, _principal, input, options) => application.getLocalStats(input, options),
    resultChatIds: (input, data) => input.groupBy === 'chat'
      ? (data.buckets as Array<{ key?: string }> | undefined)?.map(bucket => bucket.key)
      : undefined,
  }),
  'database.indexes.list': defineRemoteHandler({
    input: remoteMethods['database.indexes.list'].input,
    scope: requireAllChatAccess,
    invoke: (application, _principal, input, options) => application.database.listIndexes(input, options),
    resultChatIds: () => undefined,
  }),
  'database.indexes.drop': defineRemoteHandler({
    input: remoteMethods['database.indexes.drop'].input,
    scope: requireAllChatAccess,
    invoke: (application, _principal, input, options) => application.database.dropIndexes(input, options),
    resultChatIds: () => undefined,
  }),
  'database.indexes.rebuild': defineRemoteHandler({
    input: remoteMethods['database.indexes.rebuild'].input,
    scope: requireAllChatAccess,
    invoke: (application, _principal, input, options) => application.database.rebuildIndexes(input, options),
    resultChatIds: () => undefined,
  }),
  'database.vector.get': defineRemoteHandler({
    input: remoteMethods['database.vector.get'].input,
    scope: requireAllChatAccess,
    invoke: (application, _principal, input, options) => application.database.getVector(input, options),
    resultChatIds: () => undefined,
  }),
  'database.vector.set': defineRemoteHandler({
    input: remoteMethods['database.vector.set'].input,
    scope: requireAllChatAccess,
    invoke: (application, _principal, input, options) => application.database.setVector(input, options),
    resultChatIds: () => undefined,
  }),
} satisfies Record<RemoteMethod, RemoteMethodHandler>

function assertResultScope(principal: RemotePrincipal, handler: RemoteMethodHandler, input: Record<string, unknown>, result: unknown): void {
  if (principal.readableChatIds === undefined)
    return
  const response = result as { ok?: boolean, data?: Record<string, unknown> }
  if (!response.ok || !response.data)
    return
  const allowed = new Set(principal.readableChatIds)
  const chatIds = handler.resultChatIds(input, response.data)
  if (chatIds?.some(chatId => chatId === undefined || !allowed.has(chatId)))
    throw new RemoteScopeViolationError()
}

function summarizeInput(method: RemoteMethod, input: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {}
  for (const key of ['cursor', 'limit', 'from', 'to', 'fromUserId', 'messageId', 'before', 'after', 'groupBy', 'timeZone', 'useVector', 'kind', 'missingOnly', 'enabled']) {
    if (input[key] !== undefined)
      summary[key] = input[key]
  }
  if (typeof input.query === 'string') {
    summary.queryLength = input.query.length
    summary.queryHash = createHash('sha256').update(input.query).digest('hex')
  }
  if (method === 'chats.list' && input.types !== undefined)
    summary.types = input.types
  return summary
}

function summarizeResult(result: unknown): Record<string, unknown> {
  const response = result as { ok?: boolean, data?: { items?: unknown[], messages?: unknown[], total?: number, buckets?: unknown[] }, error?: { code?: string } }
  if (!response.ok)
    return { ok: false, errorCode: response.error?.code }
  return {
    ok: true,
    itemCount: response.data?.items?.length ?? response.data?.messages?.length,
    total: response.data?.total,
    bucketCount: response.data?.buckets?.length,
  }
}

function inputChatIds(input: Record<string, unknown>): string[] {
  if (Array.isArray(input.chatIds))
    return input.chatIds as string[]
  return typeof input.chatId === 'string' ? [input.chatId] : []
}

function errorResponse(code: string, message: string, status: number, requestId: string): Response {
  return Response.json({ ok: false, error: { code, message, retryable: false } }, { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
}

class RemoteInputError extends Error {
  constructor(public code: 'UNSUPPORTED_MEDIA_TYPE' | 'INVALID_ARGUMENT', public status: 400 | 415) {
    super(code === 'INVALID_ARGUMENT' ? 'Invalid request parameters' : 'Unsupported media type')
    this.name = 'RemoteInputError'
  }
}

/** The outcome of one remote call, independent of the transport that carried it. */
export type RemoteExecution
  = | { kind: 'result', result: unknown }
    | { kind: 'rejected', status: 400 | 403 | 404 | 415, code: string, message: string }

export interface RemoteCallContext {
  requestId: string
  signal: AbortSignal
  userAgent?: string
  /** Reads the raw call input after capability checks; may throw {@link RemoteInputError} or an h3 `HTTPError`. */
  readInput: () => Promise<unknown>
}

export interface RemoteExecutor {
  execute: (principal: RemotePrincipal, method: string, context: RemoteCallContext) => Promise<RemoteExecution>
}

export interface RemoteExecutorOptions {
  getApplication: (accountId: string) => RemoteApplication
  recordAudit: (event: RemoteAuditEvent) => Promise<void>
  media: RemoteMediaLinks
}

/**
 * Runs one remote method for a verified principal: capability, chat scope,
 * invocation, result scope assertion, and fail-closed audit. REST and MCP both
 * call this so their authorization cannot drift apart.
 */
export function createRemoteExecutor({ getApplication, recordAudit, media }: RemoteExecutorOptions): RemoteExecutor {
  async function execute(principal: RemotePrincipal, method: string, context: RemoteCallContext): Promise<RemoteExecution> {
    const startedAt = performance.now()
    let parsedInput: Record<string, unknown> = {}
    let scopedInput: Record<string, unknown> = {}
    let auditStarted = false
    const audit = async (fields: Pick<RemoteAuditEvent, 'decision' | 'outcome'> & Partial<Pick<RemoteAuditEvent, 'errorCode' | 'resultSummary'>>) => {
      auditStarted = true
      await recordAudit({
        requestId: context.requestId,
        credentialId: principal.clientId,
        credentialName: principal.clientName,
        userId: principal.userId,
        accountId: principal.accountId,
        method,
        chatIds: (() => {
          const requested = inputChatIds(Object.keys(scopedInput).length > 0 ? scopedInput : parsedInput)
          if (requested.length > 0)
            return requested
          return principal.readableChatIds === undefined ? ['*'] : [...principal.readableChatIds]
        })(),
        decision: fields.decision,
        outcome: fields.outcome,
        errorCode: fields.errorCode,
        requestSummary: summarizeInput(remoteMethodNames.includes(method as RemoteMethod) ? method as RemoteMethod : 'chats.list', parsedInput),
        resultSummary: fields.resultSummary ?? {},
        durationMs: Math.round(performance.now() - startedAt),
        userAgent: context.userAgent,
      })
    }
    const reject = async (status: 400 | 403 | 404 | 415, code: string, message: string): Promise<RemoteExecution> => {
      await audit({ decision: 'denied', outcome: 'failure', errorCode: code })
      return { kind: 'rejected', status, code, message }
    }

    try {
      if (!remoteMethodNames.includes(method as RemoteMethod))
        return await reject(404, 'NOT_FOUND', 'Unknown remote method')
      const remoteMethod = method as RemoteMethod
      const handler: RemoteMethodHandler = remoteHandlers[remoteMethod]
      requireCapability(principal, remoteMethod)
      const raw = await context.readInput()
      const parsed = safeParse(handler.input, raw)
      if (!parsed.success)
        throw new RemoteInputError('INVALID_ARGUMENT', 400)
      parsedInput = parsed.output as Record<string, unknown>
      scopedInput = handler.scope(principal, parsedInput)
      const operation = scopedInput.operation as { deadlineAt?: number } | undefined
      const options: ReadOperationOptions = {
        signal: context.signal,
        deadlineAt: operation?.deadlineAt,
      }
      const application = getApplication(principal.accountId)
      const result = remoteMethod === 'media.createLink'
        ? await media.createLink(scopedInput as InferOutput<(typeof remoteMethods)['media.createLink']['input']>, options, application, principal.accountId)
        : await handler.invoke(application, principal, scopedInput, options)
      assertResultScope(principal, handler, scopedInput, result)
      const resultSummary = summarizeResult(result)
      await audit({
        decision: 'allowed',
        outcome: resultSummary.ok === true ? 'success' : 'failure',
        errorCode: typeof resultSummary.errorCode === 'string' ? resultSummary.errorCode : undefined,
        resultSummary,
      })
      return { kind: 'result', result }
    }
    catch (error) {
      if (auditStarted)
        throw error
      if (error instanceof RemotePermissionError)
        return await reject(403, 'PERMISSION_DENIED', error.message)
      if (error instanceof RemoteInputError)
        return await reject(error.status, error.code, error.message)
      if (error instanceof HTTPError && error.status === 400)
        return await reject(400, 'INVALID_ARGUMENT', 'Invalid request parameters')
      await audit({
        decision: 'allowed',
        outcome: 'failure',
        errorCode: error instanceof RemoteScopeViolationError ? 'REMOTE_SCOPE_VIOLATION' : 'INTERNAL_ERROR',
      })
      throw error
    }
  }

  return { execute }
}

/** REST transport for remote methods: `POST /:method` with a bearer access token. */
export function createRemoteApi(authenticate: RemoteAuthenticator, executor: RemoteExecutor, media: RemoteMediaLinks): H3 {
  const app = new H3()
  app.get('/media.download', event => media.download(event))
  app.head('/media.download', event => media.download(event))
  app.post('/:method', async (event) => {
    const authentication = await authenticate(event.req)
    if ('response' in authentication)
      return authentication.response

    const requestId = randomUUID()
    setResponseHeader(event, 'X-Request-Id', requestId)
    try {
      const execution = await executor.execute(authentication.principal, event.context.params?.method ?? '', {
        requestId,
        signal: event.req.signal,
        userAgent: event.req.headers.get('user-agent') ?? undefined,
        readInput: async () => {
          if (!event.req.headers.get('content-type')?.startsWith('application/json'))
            throw new RemoteInputError('UNSUPPORTED_MEDIA_TYPE', 415)
          assertBodySize(event, 65_536)
          return await readBody(event)
        },
      })
      if (execution.kind === 'result')
        return Response.json(execution.result, { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
      if (execution.status === 404 || execution.status === 415)
        return new Response(null, { status: execution.status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
      return errorResponse(execution.code, execution.message, execution.status, requestId)
    }
    catch (error) {
      throw new HTTPError(error instanceof Error ? error.message : 'Remote request failed', {
        status: error instanceof HTTPError ? error.status : 500,
        cause: error,
        headers: { 'X-Request-Id': requestId },
        unhandled: true,
      })
    }
  })
  return app
}
