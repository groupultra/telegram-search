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
        capabilities: ['chats.list', 'messages.list', 'messages.query', 'messages.search', 'messages.context', 'stats.get'],
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
    listChats: vi.fn(async () => ({ ok: true as const, data: { items: [{ id: resultMessage.chatId, name: 'Project', type: 'group' as const }], nextCursor: null } })),
    listStoredChats: vi.fn(async () => ({ ok: true as const, data: { items: [{ id: resultMessage.chatId, name: 'Project', type: 'group' as const }], nextCursor: null } })),
    getReplyContext: vi.fn(),
    readMessages: vi.fn(),
    getMessages: vi.fn(async () => ({ ok: true as const, data: { source: 'local' as const, items: [], missingIds: [] } })),
    listRemoteMessages: vi.fn(async () => page),
    readMessageMedia: vi.fn<TelegramApplication['readMessageMedia']>(async input => ({ ok: true, data: {
      source: input.source,
      chatId: resultMessage.chatId,
      messageId: input.messageId,
      mediaIndex: input.mediaIndex,
      type: 'photo',
      mimeType: 'image/jpeg',
      size: 4,
      encoding: 'base64',
      data: 'dGVzdA==',
      offset: 0,
      nextOffset: null,
      contentStatus: 'complete',
    } })),
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
  it.each(['messages.replies', 'messages.read'] as const)('requires chat permission before %s can expand or page', async (method) => {
    const { app, application } = fixture({ access: access({ capabilities: [method] }) })
    const response = await app.request(`/v1/remote/${method}`, { method: 'POST', headers: headers(), body: JSON.stringify({ source: 'telegram', chatId: '8', messageIds: ['42'] }) })
    expect(response.status).toBe(403)
    expect(application.getReplyContext).not.toHaveBeenCalled()
    expect(application.readMessages).not.toHaveBeenCalled()
  })

  it('authorizes explicit point reads before calling the application', async () => {
    const { app, application } = fixture({ access: access({ capabilities: ['messages.get'] }) })
    const request = (chatId: string) => app.request('/v1/remote/messages.get', { method: 'POST', headers: headers(), body: JSON.stringify({ source: 'local', chatId, messageIds: ['42'] }) })
    expect((await request('8')).status).toBe(403)
    expect(application.getMessages).not.toHaveBeenCalled()
    expect((await request('7')).status).toBe(200)
    expect(application.getMessages).toHaveBeenCalledExactlyOnceWith({ source: 'local', chatId: '7', messageIds: ['42'] }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('requires media capability and chat scope before returning attachment bytes', async () => {
    const { app, application } = fixture({ access: access({ capabilities: ['media.read'] }) })
    const request = (chatId: string) => app.request('/v1/remote/media.read', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ source: 'telegram', chatId, messageId: '42', length: 4, maxBytes: 100 }),
    })
    expect((await request('8')).status).toBe(403)
    expect(application.readMessageMedia).not.toHaveBeenCalled()
    const response = await request('7')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, data: { chatId: '7', data: 'dGVzdA==', nextOffset: null, contentStatus: 'complete' } })
    expect(application.readMessageMedia).toHaveBeenCalledOnce()
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
    expect(allowed.application.listStoredChats).toHaveBeenCalledWith({ limit: 100 }, ['7'], expect.objectContaining({ signal: expect.any(AbortSignal) }))

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
