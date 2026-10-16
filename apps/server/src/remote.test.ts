import type { TelegramApplication } from '@tg-search/core'

import { H3 } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import { createRemoteApi } from './remote'

const access = { token: 'synthetic-token-'.repeat(4), accountId: '11111111-1111-4111-8111-111111111111' }

function fixture() {
  const application = {
    listChats: vi.fn(),
    getMessages: vi.fn<TelegramApplication['getMessages']>(async input => ({ ok: true, data: { source: input.source, items: [], missingIds: input.messageIds } })),
    getReplyContext: vi.fn<TelegramApplication['getReplyContext']>(async input => ({ ok: true, data: { source: input.source, items: [], roots: [], links: [], budget: { maxDepth: input.maxDepth, maxNodes: input.maxNodes }, coverage: { complete: true, resolvedReplies: 0, missingReplies: 0, notRequestedReplies: 0, depthStopped: 0, nodeStopped: 0, cycles: 0 } } })),
    readMessages: vi.fn<TelegramApplication['readMessages']>(async input => ({ ok: true, data: { source: input.source, chatId: input.chatId, items: [], window: { from: input.from, to: input.to }, nextCursor: null, pagesRead: 1, stopReason: 'exhausted', coverage: { windowExhausted: true, replyContext: 'not_requested', mediaContent: 'not_requested' } } })),
    listRemoteMessages: vi.fn(),
    queryLocalMessages: vi.fn(),
    searchLocalMessages: vi.fn(),
    getLocalMessageContext: vi.fn(),
    getLocalStats: vi.fn(),
    async* sync() {},
  } satisfies TelegramApplication
  const getApplication = vi.fn(() => application)
  const app = new H3()
  app.mount('/v1/remote', createRemoteApi(access, getApplication))
  return { app, application, getApplication }
}

function headers() {
  return { 'authorization': `Bearer ${access.token}`, 'content-type': 'application/json' }
}

describe('authenticated point reads', () => {
  it.each([undefined, 'Bearer incorrect-token'])('rejects an unauthenticated point read before resolving any account (%s)', async (authorization) => {
    const { app, application, getApplication } = fixture()
    const response = await app.request('/v1/remote/messages.get', { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization === undefined ? {} : { authorization }) }, body: JSON.stringify({ source: 'local', chatId: '42', messageIds: ['1'] }) })
    expect(response.status).toBe(401)
    expect(getApplication).not.toHaveBeenCalled()
    expect(application.getMessages).not.toHaveBeenCalled()
  })

  it('keeps the configured account and propagates per-request cancellation and deadline', async () => {
    const { app, application, getApplication } = fixture()
    const deadlineAt = Date.now() + 60_000
    const response = await app.request('/v1/remote/messages.get', { method: 'POST', headers: headers(), body: JSON.stringify({ source: 'local', chatId: '42', messageIds: ['1'], accountId: '22222222-2222-4222-8222-222222222222', operation: { deadlineAt } }) })
    expect(response.status).toBe(200)
    expect(getApplication).toHaveBeenCalledExactlyOnceWith(access.accountId)
    expect(application.getMessages).toHaveBeenCalledExactlyOnceWith({ source: 'local', chatId: '42', messageIds: ['1'], operation: { deadlineAt } }, expect.objectContaining({ signal: expect.any(AbortSignal), deadlineAt }))
    expect(await response.json()).toEqual({ ok: true, data: { source: 'local', items: [], missingIds: ['1'] } })
  })

  it('rejects an empty point-read batch before calling the application', async () => {
    const { app, application } = fixture()
    const response = await app.request('/v1/remote/messages.get', { method: 'POST', headers: headers(), body: JSON.stringify({ source: 'local', chatId: '42', messageIds: [] }) })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })
    expect(application.getMessages).not.toHaveBeenCalled()
  })
})

describe.each([
  { method: 'messages.replies', invoke: 'getReplyContext' as const, input: { source: 'local', chatId: '42', messageIds: ['1'] }, defaults: { maxDepth: 1, maxNodes: 100 } },
  { method: 'messages.read', invoke: 'readMessages' as const, input: { source: 'local', chatId: '42' }, defaults: { pageSize: 100, maxPages: 10, maxMessages: 1000 } },
])('authenticated $method', ({ method, invoke, input, defaults }) => {
  it.each([undefined, 'Bearer incorrect-token'])('rejects an unauthorized request before resolving any account (%s)', async (authorization) => {
    const { app, application, getApplication } = fixture()
    const response = await app.request(`/v1/remote/${method}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization === undefined ? {} : { authorization }) }, body: JSON.stringify(input) })
    expect(response.status).toBe(401)
    expect(getApplication).not.toHaveBeenCalled()
    expect(application[invoke]).not.toHaveBeenCalled()
  })

  it('keeps the configured account and propagates cancellation and deadline', async () => {
    const { app, application, getApplication } = fixture()
    const deadlineAt = Date.now() + 60_000
    // Caller-supplied account fields cannot broaden the configured account boundary.
    const response = await app.request(`/v1/remote/${method}`, { method: 'POST', headers: headers(), body: JSON.stringify({ ...input, accountId: '22222222-2222-4222-8222-222222222222', operation: { deadlineAt } }) })
    expect(response.status).toBe(200)
    expect(getApplication).toHaveBeenCalledExactlyOnceWith(access.accountId)
    expect(application[invoke]).toHaveBeenCalledExactlyOnceWith({ ...input, ...defaults, operation: { deadlineAt } }, expect.objectContaining({ signal: expect.any(AbortSignal), deadlineAt }))
    expect(await response.json()).toMatchObject({ ok: true, data: { source: 'local' } })
  })

  it('rejects invalid source instead of falling back to a different source', async () => {
    const { app, application } = fixture()
    const response = await app.request(`/v1/remote/${method}`, { method: 'POST', headers: headers(), body: JSON.stringify({ ...input, source: 'unknown' }) })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })
    expect(application[invoke]).not.toHaveBeenCalled()
  })
})
