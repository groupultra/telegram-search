import type { TelegramApplication } from '@tg-search/core'

import { H3 } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import { createRemoteApi } from './remote'

const access = { token: 'synthetic-token-'.repeat(4), accountId: '11111111-1111-4111-8111-111111111111' }

function fixture() {
  const application = {
    listChats: vi.fn(),
    getMessages: vi.fn<TelegramApplication['getMessages']>(async input => ({ ok: true, data: { source: input.source, items: [], missingIds: input.messageIds } })),
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
