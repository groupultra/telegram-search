import type { MessageMediaContent, MessageMediaDescriptor, ReadOperationOptions, TelegramApplication } from '@tg-search/core'

import { Buffer } from 'node:buffer'

import { H3, serve } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRemoteApi } from './remote'

const access = { token: 'synthetic-media-link-token-'.repeat(3), accountId: '11111111-1111-4111-8111-111111111111' }
const input = { source: 'local' as const, chatId: '4242424242', messageId: '700000001', mediaIndex: 0, maxBytes: 10 * 1024 * 1024 }
const servers: Array<ReturnType<typeof serve>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
})

async function fixture(options: { access?: typeof access, now?: () => number, maxConcurrentDownloads?: number, downloadTimeoutMs?: number } = {}) {
  const configured = options.access ?? access
  const bytes = Buffer.from('synthetic attachment bytes')
  const descriptor: MessageMediaDescriptor = { fileId: 'synthetic-file-id', type: 'photo', size: bytes.length, mimeType: 'image/png', fileName: 'synthetic.png' }
  const inspect = vi.fn<TelegramApplication['inspectMessageMedia']>(async () => ({ ok: true, data: descriptor }))
  const download = vi.fn<TelegramApplication['downloadMessageMedia']>(async () => ({ ok: true, data: { ...descriptor, bytes } }))
  const unused = vi.fn(async (): Promise<never> => {
    throw new Error('Unexpected application operation')
  })
  const application = {
    inspectMessageMedia: inspect,
    downloadMessageMedia: download,
    readMessageMedia: unused,
    getMessages: unused,
    getReplyContext: unused,
    readMessages: unused,
    listChats: unused,
    listRemoteMessages: unused,
    queryLocalMessages: unused,
    searchLocalMessages: unused,
    getLocalMessageContext: unused,
    getLocalStats: unused,
    async* sync() {},
  } satisfies TelegramApplication
  const resolve = vi.fn((_accountId: string) => application)
  const app = new H3()
  app.mount('/v1/remote', createRemoteApi(configured, resolve, options))
  const server = serve(app, { hostname: '127.0.0.1', port: 0, silent: true })
  servers.push(server)
  await server.ready()
  const origin = server.url!
  const requestLink = (body: unknown = input, token = configured.token) => fetch(new URL('/v1/remote/media.createLink', origin), {
    method: 'POST',
    headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  async function link(body: unknown = input) {
    const response = await requestLink(body)
    expect(response.status).toBe(200)
    const result = await response.json() as { ok: true, data: { path: string, expiresAt: number, media: Omit<MessageMediaDescriptor, 'fileId'> } }
    expect(result.ok).toBe(true)
    return { ...result.data, url: new URL(result.data.path, origin) }
  }
  return { application, resolve, descriptor, bytes, inspect, download, requestLink, link, origin }
}

function untilAborted(options: ReadOperationOptions | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    const signal = options!.signal!
    if (signal.aborted)
      reject(signal.reason)
    else
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

describe('temporary account-bound media download links over HTTP', () => {
  it('requires the existing bearer before inspecting media or resolving an account', async () => {
    const f = await fixture()
    const response = await f.requestLink(input, 'wrong-synthetic-token')
    expect(response.status).toBe(401)
    expect(f.resolve).not.toHaveBeenCalled()
    expect(f.inspect).not.toHaveBeenCalled()
    expect(f.download).not.toHaveBeenCalled()
  })

  it.each(['local', 'telegram'] as const)('issues an opaque relative link and repeatedly returns %s binary without an auth header', async (source) => {
    const now = Date.now()
    const f = await fixture({ now: () => now })
    const link = await f.link({ ...input, source, accountId: '22222222-2222-4222-8222-222222222222' })
    expect(link.path).toMatch(/^\/v1\/remote\/media\.download\?ticket=[\w-]+$/)
    expect(link.expiresAt).toBe(now + 300_000)
    expect(link.path).not.toContain(input.chatId)
    expect(link.path).not.toContain(input.messageId)
    expect(Buffer.from(link.url.searchParams.get('ticket')!, 'base64url').toString()).not.toContain(input.chatId)
    expect(link.media).toEqual({ type: 'photo', size: f.bytes.length, mimeType: 'image/png', fileName: 'synthetic.png' })
    expect(f.resolve).toHaveBeenCalledExactlyOnceWith(access.accountId)
    expect(f.inspect.mock.calls[0][0]).toMatchObject({ ...input, source })
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(link.url)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
      expect(response.headers.get('content-length')).toBe(String(f.bytes.length))
      expect(response.headers.get('cache-control')).toContain('no-store')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('content-disposition')).toMatch(/^inline;/)
      expect(Buffer.from(await response.arrayBuffer())).toEqual(f.bytes)
    }
    expect(f.download).toHaveBeenCalledTimes(2)
    expect(f.resolve.mock.calls.every(([accountId]) => accountId === access.accountId)).toBe(true)
  })

  it('validates the media identity and byte budget before issuing a link', async () => {
    const f = await fixture()
    for (const invalid of [{ source: 'automatic' }, { maxBytes: 0 }, { maxBytes: 50 * 1024 * 1024 + 1 }, { messageId: '0' }]) {
      const response = await f.requestLink({ ...input, ...invalid })
      expect(response.status).toBe(400)
    }
    expect(f.inspect).not.toHaveBeenCalled()
    const response = await f.requestLink({ ...input, maxBytes: f.bytes.length - 1 })
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'MEDIA_TOO_LARGE' } })
    expect(f.download).not.toHaveBeenCalled()
  })

  it('detects image MIME from bytes when an older indexed attachment has no stored MIME', async () => {
    // Older stored photos can omit MIME; a valid image URL must still return its image content type.
    const f = await fixture()
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=', 'base64')
    f.descriptor.mimeType = undefined
    f.descriptor.size = png.length
    f.download.mockImplementation(async () => ({ ok: true, data: { ...f.descriptor, bytes: png } }))
    const link = await f.link()
    const response = await fetch(link.url)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('content-disposition')).toMatch(/^inline;/)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
  })

  it('rejects malformed and tampered tickets before resolving account media', async () => {
    const f = await fixture()
    const link = await f.link()
    const token = link.url.searchParams.get('ticket')!
    const packed = Buffer.from(token, 'base64url')
    packed[Math.floor(packed.length / 2)]! ^= 1
    const forged = new URL(link.url)
    forged.searchParams.set('ticket', packed.toString('base64url'))
    const afterIssue = f.resolve.mock.calls.length
    for (const url of [forged, new URL('/v1/remote/media.download', f.origin), new URL(`/v1/remote/media.download?ticket=${'a'.repeat(4097)}`, f.origin)]) {
      const response = await fetch(url)
      expect(response.status).toBe(403)
      expect(response.headers.get('cache-control')).toContain('no-store')
    }
    expect(f.resolve).toHaveBeenCalledTimes(afterIssue)
    expect(f.download).not.toHaveBeenCalled()
  })

  it('keeps links valid across application instances with the same configured credentials', async () => {
    const first = await fixture()
    const link = await first.link()
    const restarted = await fixture()
    const response = await fetch(new URL(link.path, restarted.origin))
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(restarted.bytes)
    expect(restarted.resolve).toHaveBeenCalledWith(access.accountId)
  })

  it('rejects noncanonical base64url tickets even when their decoded bytes match', async () => {
    const f = await fixture()
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    let canonical!: URL
    for (let suffix = 0; suffix < 3; suffix++) {
      const link = await f.link({ ...input, chatId: `${input.chatId}${'1'.repeat(suffix)}` })
      if (link.url.searchParams.get('ticket')!.length % 4 !== 0) {
        canonical = link.url
        break
      }
    }
    const token = canonical.searchParams.get('ticket')!
    const alternative = `${token.slice(0, -1)}${alphabet[alphabet.indexOf(token.at(-1)!) + 1]}`
    expect(Buffer.from(alternative, 'base64url')).toEqual(Buffer.from(token, 'base64url'))
    const forged = new URL(canonical)
    forged.searchParams.set('ticket', alternative)
    expect((await fetch(forged)).status).toBe(403)
    expect(f.download).not.toHaveBeenCalled()
  })

  it('expires links at the fixed deadline and rejects tickets after token rotation or account changes', async () => {
    let now = Date.now()
    const f = await fixture({ now: () => now })
    const link = await f.link()
    now += 300_000
    const expired = await fetch(link.url)
    expect(expired.status).toBe(410)
    expect(await expired.json()).toMatchObject({ ok: false, error: { code: 'MEDIA_LINK_EXPIRED' } })
    const rotated = await fixture({ access: { ...access, token: 'rotated-synthetic-token-'.repeat(3) } })
    const wrongToken = await fetch(new URL(link.path, rotated.origin))
    expect(wrongToken.status).toBe(403)
    expect(rotated.resolve).not.toHaveBeenCalled()
    const otherAccount = await fixture({ access: { ...access, accountId: '22222222-2222-4222-8222-222222222222' } })
    const wrongAccount = await fetch(new URL(link.path, otherAccount.origin))
    expect(wrongAccount.status).toBe(403)
    expect(otherAccount.resolve).not.toHaveBeenCalled()
  })

  it('uses HEAD to inspect an existing capability without downloading bytes', async () => {
    const f = await fixture()
    const link = await f.link()
    const response = await fetch(link.url, { method: 'HEAD' })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe(String(f.bytes.length))
    expect((await response.arrayBuffer()).byteLength).toBe(0)
    expect(f.download).not.toHaveBeenCalled()
  })

  it('rejects changed attachments before reading bytes and verifies identity again after download', async () => {
    const f = await fixture()
    const link = await f.link()
    f.inspect.mockResolvedValueOnce({ ok: true, data: { ...f.descriptor, fileId: 'replacement-file' } })
    const changed = await fetch(link.url)
    expect(changed.status).toBe(409)
    expect(await changed.json()).toMatchObject({ ok: false, error: { code: 'MEDIA_CHANGED' } })
    expect(f.download).not.toHaveBeenCalled()
    f.download.mockResolvedValueOnce({ ok: true, data: { ...f.descriptor, fileId: 'replaced-during-download', bytes: f.bytes } })
    expect((await fetch(link.url)).status).toBe(409)
  })

  it('returns an explicit source error without switching from local to Telegram', async () => {
    const f = await fixture()
    f.inspect.mockResolvedValueOnce({ ok: false, error: { code: 'MEDIA_NOT_STORED', message: 'Attachment is not stored locally', retryable: false } })
    const response = await f.requestLink()
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'MEDIA_NOT_STORED' } })
    expect(f.inspect.mock.calls[0][0].source).toBe('local')
    expect(f.download).not.toHaveBeenCalled()
    const link = await f.link()
    f.inspect.mockResolvedValueOnce({ ok: false, error: { code: 'MEDIA_NOT_AVAILABLE', message: 'Attachment unavailable', retryable: false } })
    expect((await fetch(link.url)).status).toBe(404)
  })

  it.each(['inspect', 'download'] as const)('does not expose internal %s errors through a download capability', async (stage) => {
    const f = await fixture()
    const link = await f.link()
    const invoke = stage === 'inspect' ? f.inspect : f.download
    invoke.mockResolvedValueOnce({ ok: false, error: { code: 'INTERNAL', message: 'synthetic-private-marker /private/database-file', retryable: false, details: { query: 'synthetic-private-marker' } } })
    const response = await fetch(link.url)
    expect(response.status).toBe(502)
    const body = await response.text()
    expect(JSON.parse(body)).toEqual({ ok: false, error: { code: 'MEDIA_DOWNLOAD_FAILED', message: 'Unable to download attachment', retryable: false } })
    expect(body).not.toContain('synthetic-private-marker')
  })

  it('uses fixed public messages for known source failures and sanitizes issuing errors', async () => {
    const f = await fixture()
    const link = await f.link()
    f.inspect.mockResolvedValueOnce({ ok: false, error: { code: 'MEDIA_NOT_AVAILABLE', message: 'synthetic-private-marker', retryable: false, details: { path: 'synthetic-private-marker' } } })
    const response = await fetch(link.url)
    expect(response.status).toBe(404)
    const body = await response.text()
    expect(body).not.toContain('synthetic-private-marker')
    expect(JSON.parse(body)).toMatchObject({ ok: false, error: { code: 'MEDIA_NOT_AVAILABLE' } })
    f.inspect.mockResolvedValueOnce({ ok: false, error: { code: 'TELEGRAM_RPC_ERROR', message: 'synthetic-private-marker', retryable: false, details: { query: 'synthetic-private-marker' } } })
    const issuing = await f.requestLink()
    const issuingBody = await issuing.text()
    expect(issuingBody).not.toContain('synthetic-private-marker')
    expect(JSON.parse(issuingBody)).toMatchObject({ ok: false, error: { code: 'MEDIA_DOWNLOAD_FAILED' } })
  })

  it('uses attachment disposition and safely encodes filenames for documents', async () => {
    const f = await fixture()
    const descriptor = { ...f.descriptor, type: 'document', mimeType: 'text/html', fileName: 'synthetic\r\nunsafe.html' }
    f.inspect.mockResolvedValue({ ok: true, data: descriptor })
    f.download.mockResolvedValue({ ok: true, data: { ...descriptor, bytes: f.bytes } })
    const link = await f.link()
    const response = await fetch(link.url)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toMatch(/^attachment;/)
    expect(response.headers.get('content-disposition')).not.toMatch(/[\r\n]/)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(f.bytes)
  })

  it('rejects excess parallel downloads and releases a slot after client disconnection', async () => {
    const f = await fixture({ maxConcurrentDownloads: 1 })
    const link = await f.link()
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    f.download.mockImplementationOnce(async (_input, options) => {
      started()
      return untilAborted(options)
    })
    const controller = new AbortController()
    const pending = fetch(link.url, { signal: controller.signal })
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await ready
    const busy = await fetch(link.url)
    expect(busy.status).toBe(503)
    expect(await busy.json()).toMatchObject({ ok: false, error: { code: 'MEDIA_DOWNLOAD_BUSY' } })
    controller.abort()
    await rejection
    await vi.waitFor(() => expect(f.download.mock.calls[0][1]!.signal!.aborted).toBe(true))
    const retried = await fetch(link.url)
    expect(retried.status).toBe(200)
    await retried.arrayBuffer()
  })

  it('shares the capacity limit between HEAD metadata checks and GET downloads', async () => {
    const f = await fixture({ maxConcurrentDownloads: 1 })
    const link = await f.link()
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    f.inspect.mockImplementationOnce(async (_input, options) => {
      started()
      return untilAborted(options)
    })
    const controller = new AbortController()
    const pending = fetch(link.url, { method: 'HEAD', signal: controller.signal })
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await ready
    try {
      const head = await fetch(link.url, { method: 'HEAD' })
      expect(head.status).toBe(503)
      expect(head.headers.get('retry-after')).toBe('1')
      const get = await fetch(link.url)
      expect(get.status).toBe(503)
      expect(await get.json()).toMatchObject({ ok: false, error: { code: 'MEDIA_DOWNLOAD_BUSY' } })
      expect(f.inspect).toHaveBeenCalledTimes(2)
      expect(f.download).not.toHaveBeenCalled()
    }
    finally {
      controller.abort()
      await rejection
    }
    await vi.waitFor(() => expect(f.inspect.mock.calls[1][1]!.signal!.aborted).toBe(true))
    const retry = await fetch(link.url)
    expect(retry.status).toBe(200)
    await retry.arrayBuffer()
  })

  it('ends stalled downloads at a bounded deadline and permits a retry', async () => {
    const f = await fixture({ maxConcurrentDownloads: 1, downloadTimeoutMs: 40 })
    const link = await f.link()
    f.download.mockImplementationOnce(async (_input, options) => untilAborted(options))
    const response = await fetch(link.url)
    expect(response.status).toBe(504)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'REQUEST_DEADLINE_EXCEEDED' } })
    const retried = await fetch(link.url)
    expect(retried.status).toBe(200)
    await retried.arrayBuffer()
  })

  it('retains the download slot until the bounded buffer body is consumed or cancelled', async () => {
    const f = await fixture({ maxConcurrentDownloads: 1, downloadTimeoutMs: 2000 })
    const bytes = new Uint8Array(32 * 1024 * 1024)
    const descriptor = { ...f.descriptor, size: bytes.length }
    f.inspect.mockResolvedValue({ ok: true, data: descriptor })
    f.download.mockResolvedValue({ ok: true, data: { ...descriptor, bytes } } satisfies { ok: true, data: MessageMediaContent })
    const link = await f.link({ ...input, maxBytes: 50 * 1024 * 1024 })
    const first = await fetch(link.url)
    expect(first.status).toBe(200)
    expect((await fetch(link.url)).status).toBe(503)
    await first.body!.cancel()
    await vi.waitFor(async () => {
      const retry = await fetch(link.url, { method: 'HEAD' })
      expect(retry.status).toBe(200)
    })
    await vi.waitFor(async () => {
      const retry = await fetch(link.url)
      if (retry.status === 200)
        await retry.body!.cancel()
      expect(retry.status).toBe(200)
    })
  })

  it('releases an idle response body at its absolute transfer deadline', async () => {
    const f = await fixture({ maxConcurrentDownloads: 1, downloadTimeoutMs: 200 })
    const bytes = new Uint8Array(32 * 1024 * 1024)
    const descriptor = { ...f.descriptor, size: bytes.length }
    f.inspect.mockResolvedValue({ ok: true, data: descriptor })
    f.download.mockResolvedValueOnce({ ok: true, data: { ...descriptor, bytes } })
    const link = await f.link({ ...input, maxBytes: 50 * 1024 * 1024 })
    const stalled = await fetch(link.url)
    expect(stalled.status).toBe(200)
    expect((await fetch(link.url)).status).toBe(503)
    // The client keeps the body unread; the server must release its bounded buffer without waiting for it.
    f.inspect.mockResolvedValue({ ok: true, data: f.descriptor })
    const smallLink = await f.link()
    await vi.waitFor(async () => {
      const response = await fetch(smallLink.url)
      if (response.status === 200)
        await response.arrayBuffer()
      expect(response.status).toBe(200)
    }, { timeout: 1000 })
    await stalled.body!.cancel()
  })
})
