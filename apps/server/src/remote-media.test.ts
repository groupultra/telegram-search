import type { TelegramApplication } from '@tg-search/core'

import type { RemoteApplication } from './remote-application'

import { Buffer } from 'node:buffer'

import { H3, serve } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { appResult } from '../../../packages/core/src/application/errors'
import { withReadOperation } from '../../../packages/core/src/application/read-operation'
import { createMessageMediaReader } from '../../../packages/core/src/services/message-media'
import { createRemoteApi, remoteAccessFromEnv } from './remote'

const access = { token: 'synthetic-reader-token-'.repeat(3), accountId: '11111111-1111-4111-8111-111111111111' }
const serverAccess = remoteAccessFromEnv({
  TG_SEARCH_REMOTE_ACCESS: JSON.stringify({
    credentials: [{
      id: '22222222-2222-4222-8222-222222222222',
      name: 'media-reader',
      token: access.token,
      accountId: access.accountId,
      capabilities: ['media.read', 'messages.get', 'messages.replies', 'messages.read'],
      chatPermissions: [{ chatId: '42', permissions: ['read'] }],
    }],
  }),
})!
const servers: Array<ReturnType<typeof serve>> = []
const input = { source: 'local', chatId: '42', messageId: '7', length: 4, maxBytes: 8 }

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
})

async function fixture() {
  const bytes = Buffer.from('abcdefgh')
  const read = vi.fn(async (offset: number, length: number, _signal?: AbortSignal): Promise<Uint8Array> => bytes.subarray(offset, offset + length))
  const reader = createMessageMediaReader(async () => ({ fileId: 'synthetic-attachment', type: 'document', size: bytes.length, read }))
  const unused = vi.fn(async (): Promise<never> => {
    throw new Error('Unexpected application method')
  })
  const application = {
    inspectMessageMedia: unused,
    downloadMessageMedia: unused,
    listChats: unused,
    listStoredChats: unused,
    listRemoteMessages: unused,
    queryLocalMessages: unused,
    searchLocalMessages: unused,
    getLocalMessageContext: unused,
    getLocalStats: unused,
    getMessages: vi.fn<TelegramApplication['getMessages']>(async request => ({ ok: true, data: { source: request.source, items: [], missingIds: request.messageIds } })),
    getReplyContext: vi.fn<TelegramApplication['getReplyContext']>(async request => ({ ok: true, data: { source: request.source, items: [], roots: [], links: [], budget: { maxDepth: request.maxDepth, maxNodes: request.maxNodes }, coverage: { complete: true, resolvedReplies: 0, missingReplies: 0, notRequestedReplies: 0, depthStopped: 0, nodeStopped: 0, cycles: 0 } } })),
    readMessages: vi.fn<TelegramApplication['readMessages']>(async request => ({ ok: true, data: { source: request.source, chatId: request.chatId, items: [], window: {}, nextCursor: null, pagesRead: 1, stopReason: 'exhausted', coverage: { windowExhausted: true, replyContext: 'not_requested', mediaContent: 'not_requested' } } })),
    readMessageMedia: vi.fn<TelegramApplication['readMessageMedia']>(async (request, options) => appResult(() => withReadOperation(options, scope => reader(request, scope.signal)))),
    async* sync() {},
  } satisfies RemoteApplication
  const resolve = vi.fn(() => application)
  const app = new H3()
  app.mount('/v1/remote', createRemoteApi(serverAccess, resolve, vi.fn(async () => {})))
  const server = serve(app, { hostname: '127.0.0.1', port: 0, silent: true })
  servers.push(server)
  await server.ready()
  const request = (method: string, body: unknown, options: { token?: string, signal?: AbortSignal } = {}) => fetch(new URL(`/v1/remote/${method}`, server.url!), {
    method: 'POST',
    headers: { 'authorization': `Bearer ${options.token ?? access.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  })
  return { application, resolve, request, read }
}

describe('remote reads with scoped account-bound bearer authentication', () => {
  it('rejects a wrong bearer before resolving an account', async () => {
    const f = await fixture()
    const response = await f.request('media.read', input, { token: 'incorrect-synthetic-token' })
    expect(response.status).toBe(401)
    expect(f.resolve).not.toHaveBeenCalled()
    expect(f.application.readMessageMedia).not.toHaveBeenCalled()
  })

  it.each(['local', 'telegram'])('reads bounded %s media with the fixed server account and an unchanged source', async (source) => {
    const f = await fixture()
    const deadlineAt = Date.now() + 10_000
    // Account-bound credentials must work without the separate token-policy configuration.
    const response = await f.request('media.read', { ...input, source, accountId: '22222222-2222-4222-8222-222222222222', operation: { deadlineAt } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, data: { source, chatId: '42', messageId: '7', size: 8, data: 'YWJjZA==', offset: 0, nextOffset: 4, contentStatus: 'partial' } })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(f.resolve).toHaveBeenCalledExactlyOnceWith(access.accountId)
    expect(f.application.readMessageMedia).toHaveBeenCalledWith({ ...input, source, mediaIndex: 0, offset: 0, operation: { deadlineAt } }, { signal: expect.any(AbortSignal), deadlineAt })
    expect(f.read).toHaveBeenCalledWith(0, 4, expect.any(AbortSignal))
  })

  it.each(['messages.get', 'messages.replies', 'messages.read'] as const)('retains validated dispatch and operation options for %s', async (method) => {
    const f = await fixture()
    const deadlineAt = Date.now() + 10_000
    const body = { source: 'local', chatId: '42', messageIds: ['7'], operation: { deadlineAt } }
    const response = await f.request(method, body)
    expect(response.status).toBe(200)
    const handler = method === 'messages.get' ? f.application.getMessages : method === 'messages.replies' ? f.application.getReplyContext : f.application.readMessages
    expect(handler).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ source: 'local', chatId: '42', operation: { deadlineAt } }), { signal: expect.any(AbortSignal), deadlineAt })
    expect(f.resolve).toHaveBeenCalledExactlyOnceWith(access.accountId)
  })

  it.each([
    ['messages.get', { messageIds: [] }],
    ['messages.replies', { messageIds: ['7'], maxDepth: 11 }],
    ['messages.read', { maxPages: 0 }],
  ] as const)('validates %s before dispatch', async (method, invalid) => {
    const f = await fixture()
    const response = await f.request(method, { source: 'local', chatId: '42', ...invalid })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, error: { code: 'INVALID_ARGUMENT', message: 'Invalid request parameters', retryable: false } })
    expect(f.application.getMessages).not.toHaveBeenCalled()
    expect(f.application.getReplyContext).not.toHaveBeenCalled()
    expect(f.application.readMessages).not.toHaveBeenCalled()
  })

  it('rejects invalid media budgets and identity before invoking the reader', async () => {
    const f = await fixture()
    for (const invalid of [{ length: 256 * 1024 + 1 }, { maxBytes: 0 }, { offset: -1 }, { source: 'automatic' }, { messageId: '9999999999999999' }]) {
      const response = await f.request('media.read', { ...input, ...invalid })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ ok: false, error: { code: 'INVALID_ARGUMENT', message: 'Invalid request parameters', retryable: false } })
    }
    expect(f.application.readMessageMedia).not.toHaveBeenCalled()
    expect(f.read).not.toHaveBeenCalled()
  })

  it('preserves a byte budget failure without returning attachment bytes', async () => {
    const f = await fixture()
    const response = await f.request('media.read', { ...input, maxBytes: 7 })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'MEDIA_TOO_LARGE' } })
    expect(f.read).not.toHaveBeenCalled()
  })

  it('honors an expired operation deadline before reading bytes', async () => {
    const f = await fixture()
    const deadlineAt = Date.now() - 1
    const response = await f.request('media.read', { ...input, operation: { deadlineAt } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'REQUEST_DEADLINE_EXCEEDED' } })
    expect(f.read).not.toHaveBeenCalled()
  })

  it('propagates a real HTTP disconnect to the media operation signal', async () => {
    const f = await fixture()
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    let cancelled: unknown
    f.read.mockImplementationOnce(async (_offset, _length, signal) => new Promise<Uint8Array>((_resolve, reject) => {
      signal!.addEventListener('abort', () => {
        cancelled = signal!.reason
        reject(cancelled)
      }, { once: true })
      started()
    }))
    const controller = new AbortController()
    const pending = f.request('media.read', { ...input, operation: { deadlineAt: Date.now() + 1500 } }, { signal: controller.signal })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await ready
    controller.abort()
    await rejected
    await vi.waitFor(() => expect(cancelled).toMatchObject({ code: 'REQUEST_CANCELLED' }), { timeout: 500 })
    expect(f.application.readMessageMedia.mock.calls[0][1]!.signal!.aborted).toBe(true)
  })
})
