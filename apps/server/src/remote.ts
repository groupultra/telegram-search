import type { ReadOperationOptions } from '@tg-search/core'
import type { RemoteMethod } from '@tg-search/protocol'
import type { GenericSchema, InferOutput } from 'valibot'

import type { RemoteApplication } from './remote-application'
import type { RemoteMediaOptions } from './remote-media-links'

import { createHash, randomUUID } from 'node:crypto'

import { accountIdSchema, remoteMethods } from '@tg-search/protocol'
import { assertBodySize, H3, HTTPError, readValidatedBody, setResponseHeader } from 'h3'
import { array, integer, maxLength, minLength, number, object, optional, parse, picklist, pipe, regex, string, toLowerCase, uuid } from 'valibot'

import { createRemoteMediaLinks } from './remote-media-links'

const remoteMethodNames = Object.keys(remoteMethods) as [RemoteMethod, ...RemoteMethod[]]

const remoteCredentialSchema = object({
  id: pipe(string(), uuid(), toLowerCase()),
  name: pipe(string(), minLength(1), maxLength(128)),
  token: pipe(string(), minLength(32, 'remote access tokens must contain at least 32 characters'), regex(/^\S+$/, 'remote access tokens must not contain whitespace')),
  accountId: accountIdSchema,
  expiresAt: optional(pipe(number(), integer())),
  capabilities: array(picklist(remoteMethodNames)),
  chatPermissions: array(object({
    chatId: pipe(string(), minLength(1), maxLength(128)),
    permissions: array(picklist(['read'])),
  })),
})

const remoteAccessSchema = object({
  credentials: pipe(array(remoteCredentialSchema), minLength(1)),
})

export interface RemoteCredential {
  id: string
  name: string
  accountId: string
  expiresAt?: number
  capabilities: ReadonlySet<RemoteMethod>
  readableChatIds?: readonly string[]
  tokenHash: string
}

export interface RemoteAccess {
  credentialsByTokenHash: ReadonlyMap<string, RemoteCredential>
}

export interface RemoteAuditEvent {
  requestId: string
  credentialId: string
  credentialName: string
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

export function remoteAccessFromEnv(env: Record<string, string | undefined>): RemoteAccess | undefined {
  const raw = env.TG_SEARCH_REMOTE_ACCESS
  if (raw === undefined)
    return undefined

  let value: unknown
  try {
    value = JSON.parse(raw)
  }
  catch (error) {
    throw new Error('TG_SEARCH_REMOTE_ACCESS must contain valid JSON', { cause: error })
  }

  const parsed = parse(remoteAccessSchema, value)
  const credentialsByTokenHash = new Map<string, RemoteCredential>()
  const credentialIds = new Set<string>()
  for (const credential of parsed.credentials) {
    if (credentialIds.has(credential.id))
      throw new Error(`TG_SEARCH_REMOTE_ACCESS contains duplicate credential id ${credential.id}`)
    credentialIds.add(credential.id)

    const tokenHash = hashToken(credential.token)
    if (credentialsByTokenHash.has(tokenHash))
      throw new Error('TG_SEARCH_REMOTE_ACCESS contains a duplicate token')

    const readAll = credential.chatPermissions.some(grant => grant.chatId === '*' && grant.permissions.includes('read'))
    credentialsByTokenHash.set(tokenHash, {
      id: credential.id,
      name: credential.name,
      accountId: credential.accountId,
      expiresAt: credential.expiresAt,
      capabilities: new Set(credential.capabilities),
      readableChatIds: readAll ? undefined : uniqueSortedChatIds(credential.chatPermissions),
      tokenHash,
    })
  }
  return { credentialsByTokenHash }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function uniqueSortedChatIds(grants: Array<{ chatId: string, permissions: 'read'[] }>): string[] {
  return [...new Set(grants.filter(grant => grant.chatId !== '*' && grant.permissions.includes('read')).map(grant => grant.chatId))].sort()
}

function authenticate(access: RemoteAccess, authorization: string | null): RemoteCredential | undefined {
  if (!authorization?.startsWith('Bearer '))
    return undefined
  const credential = access.credentialsByTokenHash.get(hashToken(authorization.slice('Bearer '.length)))
  if (!credential || (credential.expiresAt !== undefined && credential.expiresAt <= Date.now()))
    return undefined
  return credential
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

function requireCapability(credential: RemoteCredential, method: RemoteMethod): void {
  if (!credential.capabilities.has(method))
    throw new RemotePermissionError('This credential cannot use the requested feature')
}

function scopeChatIds(credential: RemoteCredential, requested?: string[]): string[] | undefined {
  if (credential.readableChatIds === undefined)
    return requested
  if (credential.readableChatIds.length === 0)
    throw new RemotePermissionError('This credential cannot read any chats')
  if (!requested?.length)
    return [...credential.readableChatIds]
  const allowed = new Set(credential.readableChatIds)
  if (requested.some(chatId => !allowed.has(chatId)))
    throw new RemotePermissionError('This credential cannot read one or more requested chats')
  return requested
}

function requireReadableChat(credential: RemoteCredential, chatId: string): void {
  if (credential.readableChatIds !== undefined && !credential.readableChatIds.includes(chatId))
    throw new RemotePermissionError('This credential cannot read the requested chat')
}

interface RemoteMethodHandler {
  input: GenericSchema
  scope: (credential: RemoteCredential, input: unknown) => Record<string, unknown>
  invoke: (application: RemoteApplication, credential: RemoteCredential, input: Record<string, unknown>, options: ReadOperationOptions) => Promise<unknown>
  resultChatIds: (input: Record<string, unknown>, data: Record<string, unknown>) => Array<string | undefined> | undefined
}

type HandlerInput<Schema extends GenericSchema> = InferOutput<Schema> & Record<string, unknown>

function defineRemoteHandler<Schema extends GenericSchema>(definition: {
  input: Schema
  scope: (credential: RemoteCredential, input: HandlerInput<Schema>) => HandlerInput<Schema>
  invoke: (application: RemoteApplication, credential: RemoteCredential, input: HandlerInput<Schema>, options: ReadOperationOptions) => Promise<unknown>
  resultChatIds: (input: HandlerInput<Schema>, data: Record<string, unknown>) => Array<string | undefined> | undefined
}): RemoteMethodHandler {
  return {
    input: definition.input,
    scope: (credential, input) => definition.scope(credential, input as HandlerInput<Schema>),
    invoke: (application, credential, input, options) => definition.invoke(application, credential, input as HandlerInput<Schema>, options),
    resultChatIds: (input, data) => definition.resultChatIds(input as HandlerInput<Schema>, data),
  }
}

function scopeMultipleChats<Input extends { chatIds?: string[] } & Record<string, unknown>>(credential: RemoteCredential, input: Input): Input {
  const chatIds = scopeChatIds(credential, input.chatIds)
  return chatIds === undefined ? input : { ...input, chatIds }
}

function scopeSingleChat<Input extends { chatId: string } & Record<string, unknown>>(credential: RemoteCredential, input: Input): Input {
  requireReadableChat(credential, input.chatId)
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
    invoke: (application, _credential, input, options) => application.readMessageMedia(input, options),
    resultChatIds: (_input, data) => [data.chatId as string | undefined],
  }),
  'chats.list': defineRemoteHandler({
    input: remoteMethods['chats.list'].input,
    scope: (credential, input) => {
      scopeChatIds(credential)
      return input
    },
    invoke: (application, credential, input, options) => credential.readableChatIds === undefined
      ? application.listChats(input, options)
      : application.listStoredChats(input, [...credential.readableChatIds], options),
    resultChatIds: (_input, data) => (data.items as Array<{ id?: string }> | undefined)?.map(item => item.id),
  }),
  'messages.get': defineRemoteHandler({
    input: remoteMethods['messages.get'].input,
    scope: scopeSingleChat,
    invoke: (application, _credential, input, options) => application.getMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.replies': defineRemoteHandler({
    input: remoteMethods['messages.replies'].input,
    scope: scopeSingleChat,
    invoke: (application, _credential, input, options) => application.getReplyContext(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.read': defineRemoteHandler({
    input: remoteMethods['messages.read'].input,
    scope: scopeSingleChat,
    invoke: (application, _credential, input, options) => application.readMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.list': defineRemoteHandler({
    input: remoteMethods['messages.list'].input,
    scope: scopeSingleChat,
    invoke: (application, _credential, input, options) => application.listRemoteMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.query': defineRemoteHandler({
    input: remoteMethods['messages.query'].input,
    scope: scopeMultipleChats,
    invoke: (application, _credential, input, options) => application.queryLocalMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.search': defineRemoteHandler({
    input: remoteMethods['messages.search'].input,
    scope: scopeMultipleChats,
    invoke: (application, _credential, input, options) => application.searchLocalMessages(input, options),
    resultChatIds: (_input, data) => itemChatIds(data),
  }),
  'messages.context': defineRemoteHandler({
    input: remoteMethods['messages.context'].input,
    scope: scopeSingleChat,
    invoke: (application, _credential, input, options) => application.getLocalMessageContext(input, options),
    resultChatIds: (_input, data) => (data.messages as Array<{ chatId?: string }> | undefined)?.map(item => item.chatId),
  }),
  'stats.get': defineRemoteHandler({
    input: remoteMethods['stats.get'].input,
    scope: scopeMultipleChats,
    invoke: (application, _credential, input, options) => application.getLocalStats(input, options),
    resultChatIds: (input, data) => input.groupBy === 'chat'
      ? (data.buckets as Array<{ key?: string }> | undefined)?.map(bucket => bucket.key)
      : undefined,
  }),
} satisfies Record<RemoteMethod, RemoteMethodHandler>

function assertResultScope(credential: RemoteCredential, handler: RemoteMethodHandler, input: Record<string, unknown>, result: unknown): void {
  if (credential.readableChatIds === undefined)
    return
  const response = result as { ok?: boolean, data?: Record<string, unknown> }
  if (!response.ok || !response.data)
    return
  const allowed = new Set(credential.readableChatIds)
  const chatIds = handler.resultChatIds(input, response.data)
  if (chatIds?.some(chatId => chatId === undefined || !allowed.has(chatId)))
    throw new RemoteScopeViolationError()
}

function summarizeInput(method: RemoteMethod, input: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {}
  for (const key of ['cursor', 'limit', 'from', 'to', 'fromUserId', 'messageId', 'before', 'after', 'groupBy', 'timeZone', 'useVector']) {
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

export function createRemoteApi(
  access: RemoteAccess,
  getApplication: (accountId: string) => RemoteApplication,
  recordAudit: (event: RemoteAuditEvent) => Promise<void>,
  mediaOptions?: RemoteMediaOptions,
): H3 {
  const mediaByCredentialId = new Map([...access.credentialsByTokenHash.values()].map(credential => [
    credential.id,
    createRemoteMediaLinks({ token: credential.tokenHash, accountId: credential.accountId }, getApplication, mediaOptions),
  ]))
  const mediaLinks = [...mediaByCredentialId.values()]
  const app = new H3()
  const downloadMedia = (event: Parameters<(typeof mediaLinks)[number]['download']>[0]) => {
    const ticket = event.url.searchParams.get('ticket')
    return (mediaLinks.find(media => media.accepts(ticket)) ?? mediaLinks[0]!).download(event)
  }
  app.get('/media.download', downloadMedia)
  app.head('/media.download', downloadMedia)
  app.post('/:method', async (event) => {
    const credential = authenticate(access, event.req.headers.get('authorization'))
    if (!credential)
      return new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } })

    const requestId = randomUUID()
    setResponseHeader(event, 'X-Request-Id', requestId)
    const startedAt = performance.now()
    const method = event.context.params?.method ?? ''
    let parsedInput: Record<string, unknown> = {}
    let scopedInput: Record<string, unknown> = {}
    let auditStarted = false
    const audit = async (fields: Pick<RemoteAuditEvent, 'decision' | 'outcome'> & Partial<Pick<RemoteAuditEvent, 'errorCode' | 'resultSummary'>>) => {
      auditStarted = true
      await recordAudit({
        requestId,
        credentialId: credential.id,
        credentialName: credential.name,
        accountId: credential.accountId,
        method,
        chatIds: (() => {
          const requested = inputChatIds(Object.keys(scopedInput).length > 0 ? scopedInput : parsedInput)
          if (requested.length > 0)
            return requested
          return credential.readableChatIds === undefined ? ['*'] : [...credential.readableChatIds]
        })(),
        decision: fields.decision,
        outcome: fields.outcome,
        errorCode: fields.errorCode,
        requestSummary: summarizeInput(remoteMethodNames.includes(method as RemoteMethod) ? method as RemoteMethod : 'chats.list', parsedInput),
        resultSummary: fields.resultSummary ?? {},
        durationMs: Math.round(performance.now() - startedAt),
        userAgent: event.req.headers.get('user-agent') ?? undefined,
      })
    }

    try {
      if (!remoteMethodNames.includes(method as RemoteMethod)) {
        await audit({ decision: 'denied', outcome: 'failure', errorCode: 'NOT_FOUND' })
        return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
      }
      const remoteMethod = method as RemoteMethod
      const handler: RemoteMethodHandler = remoteHandlers[remoteMethod]
      requireCapability(credential, remoteMethod)
      if (!event.req.headers.get('content-type')?.startsWith('application/json')) {
        await audit({ decision: 'denied', outcome: 'failure', errorCode: 'UNSUPPORTED_MEDIA_TYPE' })
        return new Response(null, { status: 415, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
      }
      assertBodySize(event, 65_536)

      parsedInput = await readValidatedBody(event, handler.input) as Record<string, unknown>
      scopedInput = handler.scope(credential, parsedInput)
      const operation = scopedInput.operation as { deadlineAt?: number } | undefined
      const options: ReadOperationOptions = {
        signal: event.req.signal,
        deadlineAt: operation?.deadlineAt,
      }
      const application = getApplication(credential.accountId)
      const result = remoteMethod === 'media.createLink'
        ? await mediaByCredentialId.get(credential.id)!.createLink(scopedInput as InferOutput<(typeof remoteMethods)['media.createLink']['input']>, options, application)
        : await handler.invoke(application, credential, scopedInput, options)
      assertResultScope(credential, handler, scopedInput, result)
      const resultSummary = summarizeResult(result)
      await audit({
        decision: 'allowed',
        outcome: resultSummary.ok === true ? 'success' : 'failure',
        errorCode: typeof resultSummary.errorCode === 'string' ? resultSummary.errorCode : undefined,
        resultSummary,
      })
      return Response.json(result, { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
    }
    catch (error) {
      if (auditStarted)
        throw error
      if (error instanceof RemotePermissionError) {
        await audit({ decision: 'denied', outcome: 'failure', errorCode: 'PERMISSION_DENIED' })
        return errorResponse('PERMISSION_DENIED', error.message, 403, requestId)
      }
      if (error instanceof HTTPError && error.status === 400) {
        await audit({ decision: 'denied', outcome: 'failure', errorCode: 'INVALID_ARGUMENT' })
        return errorResponse('INVALID_ARGUMENT', 'Invalid request parameters', 400, requestId)
      }
      await audit({
        decision: 'allowed',
        outcome: 'failure',
        errorCode: error instanceof RemoteScopeViolationError ? 'REMOTE_SCOPE_VIOLATION' : 'INTERNAL_ERROR',
      })
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
