import type { TelegramApplication } from '@tg-search/core'

import process from 'node:process'

import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { normalizeRemoteUrl } from '@tg-search/protocol'
import { H3, serve } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRemoteApi, remoteAccessFromEnv } from '../../../apps/server/src/remote'
import { normalizeRawArgs, runCli } from './index'
import { createRemoteRuntime } from './remote'

const access = { token: 'test-only-token-'.repeat(4), accountId: '11111111-1111-4111-8111-111111111111' }
const message = { id: '42', chatId: '7', senderId: '3', senderName: 'Test', timestamp: 1700000000, text: 'project progress', forward: { isForward: false }, media: [], links: [] }
const page = { ok: true as const, data: { items: [message], nextCursor: 'next-page', total: 37 } }

function fixture() {
  const application = {
    listChats: vi.fn(async () => ({ ok: true as const, data: { items: [{ id: '7', name: 'Project', type: 'group' as const }], nextCursor: null } })),
    getMessages: vi.fn<TelegramApplication['getMessages']>(async input => ({ ok: true, data: { source: input.source, items: [{ ...message, replyToTopId: '1', quote: { text: 'synthetic excerpt' }, groupedId: '99' }], missingIds: [] } })),
    getReplyContext: vi.fn<TelegramApplication['getReplyContext']>(async input => ({ ok: true, data: { source: input.source, items: [message], roots: [{ chatId: input.chatId, messageId: '42', status: 'resolved' }], links: [], budget: { maxDepth: input.maxDepth, maxNodes: input.maxNodes }, coverage: { complete: true, resolvedReplies: 0, missingReplies: 0, notRequestedReplies: 0, depthStopped: 0, nodeStopped: 0, cycles: 0 } } })),
    readMessages: vi.fn<TelegramApplication['readMessages']>(async input => ({ ok: true, data: { source: input.source, chatId: input.chatId, items: [message], window: { from: input.from, to: input.to }, nextCursor: null, pagesRead: 1, stopReason: 'exhausted', coverage: { windowExhausted: true, replyContext: 'not_requested', mediaContent: 'not_requested' } } })),
    listRemoteMessages: vi.fn(async () => page),
    readMessageMedia: vi.fn(),
    queryLocalMessages: vi.fn<TelegramApplication['queryLocalMessages']>(async () => page),
    searchLocalMessages: vi.fn(async () => page),
    getLocalMessageContext: vi.fn(async () => ({ ok: true as const, data: { messages: [message], targetIndex: 0 } })),
    getLocalStats: vi.fn(async () => ({ ok: true as const, data: { total: 1, buckets: [] } })),
    async* sync() {},
  } satisfies TelegramApplication
  const resolve = vi.fn(() => application)
  const app = new H3()
  app.mount('/v1', new H3())
  app.mount('/v1/remote', createRemoteApi(access, resolve))
  return { app, application, resolve }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  process.exitCode = 0
})

describe('remote CLI', () => {
  it('runs reply context and window reads through the CLI and existing authenticated HTTP route', async () => {
    const { app, application } = fixture()
    const server = serve(app, { port: 0, hostname: '127.0.0.1', silent: true })
    await server.ready()
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', access.token)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      for (const command of ['replies', 'read']) {
        stdout.mockClear()
        const args = ['messages', command, '--chat', '7', '--source', 'telegram', '--remote', server.url!, '--json']
        if (command === 'replies')
          args.push('--ids', '42')
        await runCli(args)
        const result = JSON.parse(stdout.mock.calls.map(call => String(call[0])).join(''))
        expect(result).toMatchObject({ ok: true, data: { source: 'telegram', items: [message] } })
        if (command === 'read')
          expect(result.data.coverage).toEqual({ windowExhausted: true, replyContext: 'not_requested', mediaContent: 'not_requested' })
      }
      expect(application.getReplyContext).toHaveBeenCalledWith({ source: 'telegram', chatId: '7', messageIds: ['42'], maxDepth: 1, maxNodes: 100, operation: { deadlineAt: expect.any(Number) } }, expect.objectContaining({ signal: expect.any(AbortSignal), deadlineAt: expect.any(Number) }))
      expect(application.readMessages).toHaveBeenCalledWith({ source: 'telegram', chatId: '7', pageSize: 100, maxPages: 10, maxMessages: 1000, operation: { deadlineAt: expect.any(Number) } }, expect.objectContaining({ signal: expect.any(AbortSignal), deadlineAt: expect.any(Number) }))
    }
    finally {
      await server.close()
    }
  })

  it('reads canonical point messages through the CLI and existing authenticated HTTP route', async () => {
    const { app, application } = fixture()
    const server = serve(app, { port: 0, hostname: '127.0.0.1', silent: true })
    await server.ready()
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', access.token)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      await runCli(['messages', 'get', '--chat', '7', '--ids', '42', '--source', 'local', '--remote', server.url!, '--json'])
      const result = JSON.parse(stdout.mock.calls.map(call => String(call[0])).join(''))
      expect(result).toMatchObject({ ok: true, data: { source: 'local', items: [{ id: '42', replyToTopId: '1', quote: { text: 'synthetic excerpt' }, groupedId: '99' }], missingIds: [] } })
      expect(application.getMessages).toHaveBeenCalledWith(expect.objectContaining({ source: 'local', chatId: '7', messageIds: ['42'] }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
    }
    finally {
      await server.close()
    }
  })

  it('preserves INVALID_ARGUMENT from HTTP 400', async () => {
    const { app } = fixture()
    const server = serve(app, { port: 0, hostname: '127.0.0.1', silent: true })
    await server.ready()
    const runtime = createRemoteRuntime(server.url!, access.token)
    try {
      await expect(runtime.invokes.messages.queryLocal({ limit: 0 })).resolves.toEqual({ ok: false, error: { code: 'INVALID_ARGUMENT', message: 'Invalid request parameters', retryable: false } })
    }
    finally {
      await runtime.close()
      await server.close()
    }
  })

  it('propagates cancellation over real HTTP and keeps another read available', async () => {
    const { app, application } = fixture()
    let observedSignal!: AbortSignal
    let markStarted!: () => void
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    let markCancelled!: () => void
    const cancelled = new Promise<void>((resolve) => {
      markCancelled = resolve
    })
    application.queryLocalMessages.mockImplementationOnce(async (_input, options) => {
      observedSignal = options!.signal!
      markStarted()
      return new Promise((resolve) => {
        observedSignal.addEventListener('abort', () => {
          markCancelled()
          resolve({ ok: false, error: { code: 'REQUEST_CANCELLED', message: 'Cancelled', retryable: false } })
        }, { once: true })
      })
    })
    const server = serve(app, { port: 0, hostname: '127.0.0.1', silent: true })
    await server.ready()
    const runtime = createRemoteRuntime(server.url!, access.token)
    try {
      const controller = new AbortController()
      const pending = runtime.invokes.messages.queryLocal({ limit: 1 }, { signal: controller.signal })
      await started
      controller.abort()
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'REQUEST_CANCELLED' } })
      await cancelled
      expect(observedSignal.aborted).toBe(true)
      await expect(runtime.invokes.messages.queryLocal({ limit: 1 })).resolves.toEqual(page)
    }
    finally {
      await runtime.close()
      await server.close()
    }
  })

  it('routes CLI search over HTTP without creating a local profile or database', async () => {
    const { app, application, resolve } = fixture()
    const server = serve(app, { port: 0, hostname: '127.0.0.1', silent: true })
    await server.ready()
    const home = await mkdtemp(join(tmpdir(), 'tg-remote-test-'))
    vi.stubEnv('TG_SEARCH_HOME', home)
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', access.token)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      await runCli(['--remote', server.url!, 'search', 'project', '--limit', '2', '--json'])
      const result = JSON.parse(stdout.mock.calls.map(call => String(call[0])).join(''))
      expect(result).toMatchObject({ ok: true, data: page.data, next_cursor: 'next-page', meta: { source: 'remote' } })
      expect(application.searchLocalMessages).toHaveBeenCalledWith({ query: 'project', limit: 2, useVector: false, operation: { deadlineAt: expect.any(Number) } }, expect.objectContaining({ signal: expect.any(AbortSignal), deadlineAt: expect.any(Number) }))
      expect(resolve).toHaveBeenCalledWith(access.accountId)
      expect(await readdir(home)).toEqual([])
    }
    finally {
      await server.close()
      await rm(home, { recursive: true, force: true })
    }
  })

  it('rejects unauthorized requests before resolving an account', async () => {
    const { app, resolve } = fixture()
    const response = await app.request('/v1/remote/messages.search', { method: 'POST', body: '{}' })
    expect(response.status).toBe(401)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('validates search parameters and never accepts a caller-selected account', async () => {
    const { app, application, resolve } = fixture()
    const headers = { 'authorization': `Bearer ${access.token}`, 'content-type': 'application/json' }
    const invalid = await app.request('/v1/remote/messages.search', { method: 'POST', headers, body: JSON.stringify({ query: '', limit: 0 }) })
    expect(invalid.status).toBe(400)
    expect(application.searchLocalMessages).not.toHaveBeenCalled()
    const valid = await app.request('/v1/remote/messages.search', { method: 'POST', headers, body: JSON.stringify({ query: 'project', accountId: 'other-account' }) })
    expect(valid.status).toBe(200)
    expect(resolve).toHaveBeenLastCalledWith(access.accountId)
    expect(application.searchLocalMessages).toHaveBeenCalledWith({ query: 'project', limit: 100, useVector: false }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('preserves application errors and supports pagination and context over real HTTP', async () => {
    const { app, application } = fixture()
    const server = serve(app, { port: 0, hostname: '127.0.0.1', silent: true })
    await server.ready()
    const runtime = createRemoteRuntime(server.url!, access.token)
    try {
      expect(await runtime.invokes.messages.queryLocal({ cursor: '2', limit: 2 })).toEqual(page)
      expect(await runtime.invokes.messages.contextLocal({ chatId: '7', messageId: '42', before: 1, after: 1 })).toEqual({ ok: true, data: { messages: [message], targetIndex: 0 } })
      expect(await runtime.invokes.chats.list({ limit: 1 })).toMatchObject({ ok: true, data: { items: [{ id: '7' }] } })
      expect(await runtime.invokes.messages.listRemote({ chatId: '7', limit: 2 })).toEqual(page)
      expect(await runtime.invokes.messages.queryLocal({ limit: 0 })).toEqual({ ok: false, error: { code: 'INVALID_ARGUMENT', message: 'Invalid request parameters', retryable: false } })
      expect(await runtime.invokes.stats.get({ groupBy: 'month', timeZone: 'UTC' })).toEqual({ ok: true, data: { total: 1, buckets: [] } })
      const failure = { ok: false as const, error: { code: 'NOT_FOUND', message: 'Not found', retryable: false } }
      application.queryLocalMessages.mockResolvedValueOnce(failure)
      expect(await runtime.invokes.messages.queryLocal({ limit: 2 })).toEqual(failure)
      application.queryLocalMessages.mockImplementationOnce(async () => {
        throw new Error('failure')
      })
      await expect(runtime.invokes.messages.queryLocal({ limit: 2 })).resolves.toMatchObject({ ok: false, error: { code: 'REMOTE_UNAVAILABLE' } })
      const unauthorized = createRemoteRuntime(server.url!, 'wrong-token')
      await expect(unauthorized.invokes.messages.queryLocal({ limit: 2 })).resolves.toMatchObject({ ok: false, error: { code: 'REMOTE_AUTHENTICATION_FAILED' } })
      await unauthorized.close()
      expect(() => runtime.streams.sync({ chatIds: [], all: true, takeout: false, limit: 1 })).toThrow('read commands only')
    }
    finally {
      await runtime.close()
      await server.close()
    }
  })

  it('requires secure URLs and complete server access configuration', () => {
    expect(normalizeRemoteUrl('https://example.com/')).toBe('https://example.com')
    expect(() => normalizeRemoteUrl('http://example.com')).toThrow('HTTPS')
    expect(() => normalizeRemoteUrl('https://user:password@example.com')).toThrow('credentials')
    expect(() => normalizeRemoteUrl('https://example.com?token=secret')).toThrow('query')
    expect(remoteAccessFromEnv({})).toBeUndefined()
    expect(() => remoteAccessFromEnv({ TG_SEARCH_REMOTE_TOKEN: access.token })).toThrow('UUID')
    expect(() => remoteAccessFromEnv({ TG_SEARCH_REMOTE_TOKEN: 'short', TG_SEARCH_REMOTE_ACCOUNT_ID: access.accountId })).toThrow('32')
    expect(remoteAccessFromEnv({ TG_SEARCH_REMOTE_TOKEN: access.token, TG_SEARCH_REMOTE_ACCOUNT_ID: 'ABCDEFAB-1234-4ABC-9ABC-ABCDEFABCDEF' })?.accountId).toBe('abcdefab-1234-4abc-9abc-abcdefabcdef')
    expect(normalizeRawArgs(['--remote', 'https://example.com', 'messages', 'query'])).toEqual(['messages', 'query', '--remote=https://example.com'])
  })
})
