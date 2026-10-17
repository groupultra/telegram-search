import type { TelegramApplication } from '@tg-search/core'

import type { RemoteAuditEvent } from './remote'
import type { RemoteApplication } from './remote-application'

import { H3 } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import { createRemoteApi, remoteAccessFromEnv } from './remote'

const accountId = '11111111-1111-4111-8111-111111111111'
const credentialId = '22222222-2222-4222-8222-222222222222'
const token = 'test-only-token-'.repeat(4)
const message = { id: '42', chatId: '7', senderId: '3', senderName: 'Test', timestamp: 1700000000, text: 'project progress', forward: { isForward: false }, media: [], links: [] }

function access(overrides: Record<string, unknown> = {}) {
  return remoteAccessFromEnv({
    TG_SEARCH_REMOTE_ACCESS: JSON.stringify({
      credentials: [{
        id: credentialId,
        name: 'project-reader',
        token,
        accountId,
        capabilities: ['media.read', 'chats.list', 'messages.get', 'messages.replies', 'messages.read', 'messages.list', 'messages.query', 'messages.search', 'messages.context', 'stats.get'],
        chatPermissions: [{ chatId: '7', permissions: ['read'] }],
        ...overrides,
      }],
    }),
  })!
}

function fixture(options: { access?: ReturnType<typeof access>, messageChatId?: string, auditFailure?: Error } = {}) {
  const resultMessage = { ...message, chatId: options.messageChatId ?? message.chatId }
  const page = { ok: true as const, data: { items: [resultMessage], nextCursor: null } }
  const application = {
    readMessageMedia: vi.fn<TelegramApplication['readMessageMedia']>(async input => ({ ok: true, data: { source: input.source, chatId: input.chatId, messageId: input.messageId, mediaIndex: input.mediaIndex, type: 'document', size: 4, encoding: 'base64', data: 'dGVzdA==', offset: 0, nextOffset: null, contentStatus: 'complete' } })),
    listChats: vi.fn(async () => ({ ok: true as const, data: { items: [{ id: resultMessage.chatId, name: 'Project', type: 'group' as const }], nextCursor: null } })),
    listStoredChats: vi.fn(async () => ({ ok: true as const, data: { items: [{ id: resultMessage.chatId, name: 'Project', type: 'group' as const }], nextCursor: null } })),
    getMessages: vi.fn<TelegramApplication['getMessages']>(async input => ({ ok: true, data: { source: input.source, items: [resultMessage], missingIds: [] } })),
    getReplyContext: vi.fn<TelegramApplication['getReplyContext']>(async input => ({ ok: true, data: { source: input.source, items: [resultMessage], roots: [{ chatId: input.chatId, messageId: '42', status: 'resolved' }], links: [], budget: { maxDepth: input.maxDepth, maxNodes: input.maxNodes }, coverage: { complete: true, resolvedReplies: 0, missingReplies: 0, notRequestedReplies: 0, depthStopped: 0, nodeStopped: 0, cycles: 0 } } })),
    readMessages: vi.fn<TelegramApplication['readMessages']>(async input => ({ ok: true, data: { source: input.source, chatId: input.chatId, items: [resultMessage], window: { from: input.from, to: input.to }, nextCursor: null, pagesRead: 1, stopReason: 'exhausted', coverage: { windowExhausted: true, replyContext: 'not_requested', mediaContent: 'not_requested' } } })),
    listRemoteMessages: vi.fn(async () => page),
    queryLocalMessages: vi.fn<TelegramApplication['queryLocalMessages']>(async () => page),
    searchLocalMessages: vi.fn(async () => page),
    getLocalMessageContext: vi.fn(async () => ({ ok: true as const, data: { messages: [resultMessage], targetIndex: 0 } })),
    getLocalStats: vi.fn<TelegramApplication['getLocalStats']>(async () => ({ ok: true as const, data: { total: 1, buckets: [] } })),
    async* sync() {},
  } satisfies RemoteApplication
  const resolve = vi.fn(() => application)
  const audit = vi.fn<(event: RemoteAuditEvent) => Promise<void>>(async () => {
    if (options.auditFailure)
      throw options.auditFailure
  })
  const app = new H3()
  app.mount('/v1/remote', createRemoteApi(options.access ?? access(), resolve, audit))
  return { app, application, resolve, audit }
}

function headers() {
  return { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' }
}

describe('remote access control', () => {
  it.each([
    { method: 'media.read', invoke: 'readMessageMedia' as const, input: { source: 'local', chatId: '7', messageId: '42', mediaIndex: 0 }, defaults: { offset: 0, length: 65536, maxBytes: 10485760 } },
    { method: 'messages.get', invoke: 'getMessages' as const, input: { source: 'local', chatId: '7', messageIds: ['42'] }, defaults: {} },
    { method: 'messages.replies', invoke: 'getReplyContext' as const, input: { source: 'local', chatId: '7', messageIds: ['42'] }, defaults: { maxDepth: 1, maxNodes: 100 } },
    { method: 'messages.read', invoke: 'readMessages' as const, input: { source: 'local', chatId: '7' }, defaults: { pageSize: 100, maxPages: 10, maxMessages: 1000 } },
  ])('keeps $method inside capability, chat, account, and operation boundaries', async ({ method, invoke, input, defaults }) => {
    const { app, application, resolve } = fixture()
    const deadlineAt = Date.now() + 60_000
    const response = await app.request(`/v1/remote/${method}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...input, operation: { deadlineAt } }),
    })

    expect(response.status).toBe(200)
    expect(resolve).toHaveBeenCalledExactlyOnceWith(accountId)
    expect(application[invoke]).toHaveBeenCalledExactlyOnceWith(
      { ...input, ...defaults, operation: { deadlineAt } },
      expect.objectContaining({ signal: expect.any(AbortSignal), deadlineAt }),
    )
  })

  it.each([
    ['media.read', 'readMessageMedia'],
    ['messages.get', 'getMessages'],
    ['messages.replies', 'getReplyContext'],
    ['messages.read', 'readMessages'],
  ] as const)('denies %s outside the granted chat before invoking the application', async (method, invoke) => {
    const { app, application, resolve } = fixture()
    const response = await app.request(`/v1/remote/${method}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(method === 'media.read'
        ? { source: 'local', chatId: '8', messageId: '42', mediaIndex: 0 }
        : method === 'messages.read'
          ? { source: 'local', chatId: '8' }
          : { source: 'local', chatId: '8', messageIds: ['42'] }),
    })

    expect(response.status).toBe(403)
    expect(resolve).not.toHaveBeenCalled()
    expect(application[invoke]).not.toHaveBeenCalled()
  })

  it('requires both a feature capability and chat read permission', async () => {
    const limited = access({ capabilities: ['messages.query'] })
    const { app, application, resolve, audit } = fixture({ access: limited })

    const deniedFeature = await app.request('/v1/remote/messages.search', {
      method: 'POST',
      headers: headers(),
      body: '{}',
    })
    expect(deniedFeature.status).toBe(403)
    expect(deniedFeature.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(application.searchLocalMessages).not.toHaveBeenCalled()

    const deniedChat = await app.request('/v1/remote/messages.query', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ chatIds: ['8'] }),
    })
    expect(deniedChat.status).toBe(403)
    expect(application.queryLocalMessages).not.toHaveBeenCalled()
    expect(resolve).not.toHaveBeenCalled()
    expect(audit.mock.calls.map(([event]) => event.decision)).toEqual(['denied', 'denied'])
  })

  it('scopes omitted chat filters before querying or calculating statistics', async () => {
    const { app, application } = fixture()

    const query = await app.request('/v1/remote/messages.query', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ limit: 20 }),
    })
    const stats = await app.request('/v1/remote/stats.get', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ groupBy: 'month' }),
    })

    expect(query.status).toBe(200)
    expect(stats.status).toBe(200)
    expect(application.queryLocalMessages).toHaveBeenCalledWith({ chatIds: ['7'], limit: 20 }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(application.getLocalStats).toHaveBeenCalledWith({ chatIds: ['7'], groupBy: 'month', timeZone: 'UTC' }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('passes selected chat scope into chat listing and blocks leaked output', async () => {
    const allowed = fixture()
    const response = await allowed.app.request('/v1/remote/chats.list', {
      method: 'POST',
      headers: headers(),
      body: '{}',
    })
    expect(response.status).toBe(200)
    expect(allowed.application.listStoredChats).toHaveBeenCalledWith({ limit: 100 }, ['7'])

    const leaked = fixture({ messageChatId: '8' })
    const leakedResponse = await leaked.app.request('/v1/remote/messages.query', {
      method: 'POST',
      headers: headers(),
      body: '{}',
    })
    expect(leakedResponse.status).toBe(500)
    expect(leakedResponse.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(leaked.audit).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'failure', errorCode: 'REMOTE_SCOPE_VIOLATION' }))

    const leakedStats = fixture()
    leakedStats.application.getLocalStats.mockResolvedValueOnce({
      ok: true,
      data: { total: 1, buckets: [{ key: '8', count: 1, firstTimestamp: 1, lastTimestamp: 1 }] },
    })
    const leakedStatsResponse = await leakedStats.app.request('/v1/remote/stats.get', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ groupBy: 'chat' }),
    })
    expect(leakedStatsResponse.status).toBe(500)
    expect(leakedStats.audit).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'failure', errorCode: 'REMOTE_SCOPE_VIOLATION' }))
  })

  it('audits a sanitized search summary before returning the response', async () => {
    const { app, audit } = fixture()
    const response = await app.request('/v1/remote/messages.search', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ query: 'private roadmap', limit: 2 }),
    })

    expect(response.status).toBe(200)
    expect(audit).toHaveBeenCalledOnce()
    const event = audit.mock.calls[0][0]
    expect(event).toMatchObject({
      credentialId,
      accountId,
      method: 'messages.search',
      chatIds: ['7'],
      decision: 'allowed',
      outcome: 'success',
    })
    expect(event.requestSummary).toMatchObject({ limit: 2, queryLength: 15 })
    expect(event.requestSummary.queryHash).toMatch(/^[a-f\d]{64}$/)
    expect(JSON.stringify(event)).not.toContain('private roadmap')
  })

  it('records wildcard scope explicitly and rejects invalid chat cursors', async () => {
    const wildcard = fixture({ access: access({ chatPermissions: [{ chatId: '*', permissions: ['read'] }] }) })
    const search = await wildcard.app.request('/v1/remote/messages.search', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ query: 'roadmap' }),
    })
    expect(search.status).toBe(200)
    expect(wildcard.audit).toHaveBeenLastCalledWith(expect.objectContaining({ chatIds: ['*'] }))

    const selected = fixture()
    const invalidCursor = await selected.app.request('/v1/remote/chats.list', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ cursor: '-1' }),
    })
    expect(invalidCursor.status).toBe(400)
    expect(invalidCursor.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(selected.application.listStoredChats).not.toHaveBeenCalled()
  })

  it('fails closed with only one audit attempt when persistence fails', async () => {
    const { app, audit } = fixture({ auditFailure: new Error('audit unavailable') })

    const response = await app.request('/v1/remote/messages.query', {
      method: 'POST',
      headers: headers(),
      body: '{}',
    })

    expect(response.status).toBe(500)
    expect(audit).toHaveBeenCalledOnce()
  })

  it('rejects expired credentials and invalid access configuration', async () => {
    const expired = access({ expiresAt: Date.now() - 1 })
    const { app, resolve } = fixture({ access: expired })
    const response = await app.request('/v1/remote/messages.query', { method: 'POST', headers: headers(), body: '{}' })
    expect(response.status).toBe(401)
    expect(resolve).not.toHaveBeenCalled()

    expect(() => remoteAccessFromEnv({ TG_SEARCH_REMOTE_ACCESS: '{' })).toThrow('JSON')
    expect(() => access({ chatPermissions: [{ chatId: '7', permissions: ['write'] }] })).toThrow()
    expect(() => remoteAccessFromEnv({
      TG_SEARCH_REMOTE_ACCESS: JSON.stringify({
        credentials: [
          { id: credentialId, name: 'one', token, accountId, capabilities: ['messages.query'], chatPermissions: [{ chatId: '7', permissions: ['read'] }] },
          { id: '33333333-3333-4333-8333-333333333333', name: 'two', token, accountId, capabilities: ['messages.query'], chatPermissions: [{ chatId: '8', permissions: ['read'] }] },
        ],
      }),
    })).toThrow('duplicate token')
  })
})
