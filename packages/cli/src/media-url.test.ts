import type { TelegramApplication } from '@tg-search/core'

import type { RemoteApplication } from '../../../apps/server/src/remote-application'

import process from 'node:process'

import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { H3, serve } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRemoteApi, remoteAccessFromEnv } from '../../../apps/server/src/remote'
import { runCli } from './index'
import { createRemoteRuntime } from './remote'

const homes: string[] = []
const servers: Array<ReturnType<typeof serve>> = []
const access = { token: 'synthetic-media-url-token-'.repeat(3), accountId: '11111111-1111-4111-8111-111111111111' }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=', 'base64')
const input = { source: 'local' as const, chatId: '7', messageId: '42', mediaIndex: 0, maxBytes: 10 * 1024 * 1024 }

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()))
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  process.exitCode = 0
  await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true })))
})

async function isolatedHome() {
  const home = await mkdtemp(join(tmpdir(), 'tg-media-url-'))
  homes.push(home)
  vi.stubEnv('TG_SEARCH_HOME', home)
  vi.stubEnv('TG_SEARCH_REMOTE_URL', undefined)
  vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', undefined)
  return home
}

function captureOutput() {
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  return { stdout, stderr, text: () => stdout.mock.calls.map(call => String(call[0])).join('') }
}

async function listen(app: H3) {
  const server = serve(app, { hostname: '127.0.0.1', port: 0, silent: true })
  servers.push(server)
  await server.ready()
  return server.url!.replace(/\/$/, '')
}

async function fixture(options: { prefix?: string, type?: string, mimeType?: string, bytes?: Uint8Array } = {}) {
  const now = Date.now()
  const bytes = options.bytes ?? png
  const descriptor = { fileId: 'synthetic-attachment-id', type: options.type ?? 'photo', size: bytes.length, mimeType: options.mimeType ?? 'image/png', fileName: options.type === 'document' ? 'synthetic.txt' : 'synthetic.png' }
  const unused = vi.fn(async (): Promise<never> => {
    throw new Error('Unexpected local application operation')
  })
  const application = {
    inspectMessageMedia: vi.fn<TelegramApplication['inspectMessageMedia']>(async () => ({ ok: true, data: descriptor })),
    downloadMessageMedia: vi.fn<TelegramApplication['downloadMessageMedia']>(async () => ({ ok: true, data: { ...descriptor, bytes } })),
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
    listStoredChats: unused,
  } satisfies RemoteApplication
  const resolve = vi.fn((_accountId: string) => application)
  const serverAccess = remoteAccessFromEnv({
    TG_SEARCH_REMOTE_ACCESS: JSON.stringify({
      credentials: [{
        id: '22222222-2222-4222-8222-222222222222',
        name: 'media-reader',
        token: access.token,
        accountId: access.accountId,
        capabilities: ['media.createLink'],
        chatPermissions: [{ chatId: '*', permissions: ['read'] }],
      }],
    }),
  })!
  const app = new H3()
  app.mount(`${options.prefix ?? ''}/v1/remote`, createRemoteApi(serverAccess, resolve, vi.fn(async () => {}), { now: () => now }))
  const origin = await listen(app)
  return { application, resolve, bytes, descriptor, endpoint: `${origin}${options.prefix ?? ''}`, now }
}

describe('temporary media URLs', () => {
  it.each(['local', 'telegram'])('rejects %s without a remote endpoint before creating local runtime state', async (source) => {
    const home = await isolatedHome()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    await runCli(['media', 'url', '--chat', '7', '--message', '42', '--source', source, '--json'])
    expect(JSON.parse(stdout.mock.calls.map(call => String(call[0])).join(''))).toMatchObject({
      ok: false,
      error: { code: 'REMOTE_OPERATION_UNSUPPORTED', retryable: false },
    })
    expect(process.exitCode).toBe(1)
    expect(await readdir(home)).toEqual([])
  })

  it.each(['local', 'telegram'] as const)('signs a %s image over real HTTP and downloads it without an authorization header', async (source) => {
    const home = await isolatedHome()
    const f = await fixture({ prefix: '/gateway' })
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', access.token)
    const output = captureOutput()
    await runCli(['media', 'url', '--remote', `${f.endpoint}/`, '--chat', '7', '--message', '42', '--source', source, '--timeout-ms', '5000', '--json'])
    const result = JSON.parse(output.text())
    expect(result).toMatchObject({ ok: true, data: { url: `${f.endpoint}${result.data.path}`, expiresAt: f.now + 300_000, media: { type: 'photo', size: png.length, mimeType: 'image/png', fileName: 'synthetic.png' } }, meta: { source: 'remote', execution: { mode: 'remote' } } })
    expect(result.data.url).toMatch(/\/gateway\/v1\/remote\/media\.download\?ticket=[\w-]+$/)
    expect(f.application.inspectMessageMedia).toHaveBeenCalledWith(expect.objectContaining({ ...input, source, operation: { deadlineAt: expect.any(Number) } }), expect.objectContaining({ signal: expect.any(AbortSignal), deadlineAt: expect.any(Number) }))
    // The capability URL itself authorizes the GET; callers add no server bearer header.
    const response = await fetch(result.data.url)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png)
    expect(f.application.downloadMessageMedia).toHaveBeenCalledWith(expect.objectContaining({ ...input, source }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(f.resolve.mock.calls.every(([accountId]) => accountId === access.accountId)).toBe(true)
    expect(await readdir(home)).toEqual([])
    expect(output.stderr).not.toHaveBeenCalled()
  })

  it('uses the saved remote endpoint for text output without creating local runtime files', async () => {
    const home = await isolatedHome()
    const f = await fixture({ type: 'document', mimeType: 'text/plain', bytes: Buffer.from('synthetic document') })
    const profile = join(home, 'profiles', 'configured')
    await mkdir(profile, { recursive: true, mode: 0o700 })
    await writeFile(join(profile, 'config.json'), JSON.stringify({ remoteUrl: f.endpoint }), { mode: 0o600 })
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', access.token)
    const output = captureOutput()
    await runCli(['media', 'url', '--profile', 'configured', '--chat', '7', '--message', '42', '--source', 'local'])
    expect(output.text()).toContain(`Url: ${f.endpoint}/v1/remote/media.download?ticket=`)
    expect(output.text()).toContain(`Expires At: ${f.now + 300_000}`)
    expect(output.text()).toContain('Type: document')
    expect(output.text()).toContain('Mime Type: text/plain')
    expect(output.text()).toContain(`Size: ${f.bytes.length}`)
    const url = output.text().split('\n').find(line => line.startsWith('Url: '))!.slice('Url: '.length)
    const response = await fetch(url)
    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(f.bytes)
    expect(await readdir(profile)).toEqual(['config.json'])
  })

  it('writes a temporary URL to a private result file using an environment endpoint', async () => {
    const home = await isolatedHome()
    const f = await fixture()
    vi.stubEnv('TG_SEARCH_REMOTE_URL', f.endpoint)
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', access.token)
    const output = captureOutput()
    const destination = join(home, 'private', 'link.json')
    await runCli(['media', 'url', '--chat', '7', '--message', '42', '--source', 'local', '--json', '--output-file', destination])
    expect(JSON.parse(output.text())).toMatchObject({ ok: true, data: { path: destination, status: 'completed', format: 'json' } })
    const result = JSON.parse(await readFile(destination, 'utf8'))
    expect(result.data.url).toBe(`${f.endpoint}${result.data.path}`)
    expect(result.data.expiresAt).toBe(f.now + 300_000)
    expect((await stat(destination)).mode & 0o777).toBe(0o600)
    expect(await readdir(home)).toEqual(['private'])
  })

  it.each([
    'https://outside.invalid/v1/remote/media.download?ticket=synthetic-secret',
    '//outside.invalid/v1/remote/media.download?ticket=synthetic-secret',
    '/v1/remote/media.download?ticket=synthetic-secret&redirect=https://outside.invalid',
  ])('rejects an unsafe response path without printing a link or its ticket', async (path) => {
    await isolatedHome()
    const app = new H3()
    app.post('/v1/remote/media.createLink', () => Response.json({ ok: true, data: { path, expiresAt: Date.now() + 300_000, media: { type: 'photo', size: png.length } } }))
    const endpoint = await listen(app)
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', access.token)
    const output = captureOutput()
    await runCli(['media', 'url', '--remote', endpoint, '--chat', '7', '--message', '42', '--source', 'local', '--json'])
    expect(JSON.parse(output.text())).toMatchObject({ ok: false, error: { code: 'REMOTE_PROTOCOL_MISMATCH', retryable: false } })
    expect(output.text()).not.toContain('synthetic-secret')
    expect(output.text()).not.toContain('outside.invalid')
    expect(process.exitCode).toBe(1)
  })

  it.each([
    [undefined, 'REMOTE_CREDENTIALS_MISSING'],
    ['wrong-synthetic-token', 'REMOTE_AUTHENTICATION_FAILED'],
  ])('keeps credential failures stable without creating local state', async (token, code) => {
    const home = await isolatedHome()
    const f = await fixture()
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', token)
    const output = captureOutput()
    await runCli(['media', 'url', '--remote', f.endpoint, '--chat', '7', '--message', '42', '--source', 'local', '--json'])
    expect(JSON.parse(output.text())).toMatchObject({ ok: false, error: { code, retryable: false } })
    expect(f.application.inspectMessageMedia).not.toHaveBeenCalled()
    expect(f.application.downloadMessageMedia).not.toHaveBeenCalled()
    expect(await readdir(home)).toEqual([])
  })

  it('returns INVALID_ARGUMENT for an unknown source', async () => {
    const home = await isolatedHome()
    const output = captureOutput()
    await runCli(['media', 'url', '--chat', '7', '--message', '42', '--source', 'automatic', '--json'])
    expect(JSON.parse(output.text())).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT', retryable: false } })
    expect(await readdir(home)).toEqual([])
  })

  it('does not issue an HTTP mint after the read deadline has expired', async () => {
    await isolatedHome()
    const f = await fixture()
    const runtime = createRemoteRuntime(f.endpoint, access.token)
    try {
      await expect(runtime.invokes.media.createLink(input, { deadlineAt: Date.now() - 1 })).resolves.toMatchObject({ ok: false, error: { code: 'REQUEST_DEADLINE_EXCEEDED' } })
      expect(f.application.inspectMessageMedia).not.toHaveBeenCalled()
    }
    finally {
      await runtime.close()
    }
  })

  it('returns a stable protocol failure for malformed link JSON without echoing the body', async () => {
    await isolatedHome()
    const app = new H3()
    // JSON parser errors can echo a response containing a temporary credential.
    app.post('/v1/remote/media.createLink', () => new Response('synthetic-secret: malformed JSON', { headers: { 'content-type': 'application/json' } }))
    const endpoint = await listen(app)
    vi.stubEnv('TG_SEARCH_REMOTE_TOKEN', access.token)
    const output = captureOutput()
    await runCli(['media', 'url', '--remote', endpoint, '--chat', '7', '--message', '42', '--source', 'local', '--json'])
    expect(JSON.parse(output.text())).toMatchObject({ ok: false, error: { code: 'REMOTE_PROTOCOL_MISMATCH', retryable: false } })
    expect(output.text()).not.toContain('synthetic-secret')
    expect(process.exitCode).toBe(1)
  })

  it('cancels minting through the remote operation signal without returning a URL', async () => {
    await isolatedHome()
    const f = await fixture()
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    let observedSignal!: AbortSignal
    f.application.inspectMessageMedia.mockImplementationOnce(async (_input, options) => new Promise((_resolve, reject) => {
      observedSignal = options!.signal!
      observedSignal.addEventListener('abort', () => reject(observedSignal.reason), { once: true })
      started()
    }))
    const runtime = createRemoteRuntime(f.endpoint, access.token)
    try {
      const controller = new AbortController()
      const pending = runtime.invokes.media.createLink(input, { signal: controller.signal, deadlineAt: Date.now() + 5000 })
      await ready
      controller.abort()
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'REQUEST_CANCELLED' } })
      await vi.waitFor(() => expect(observedSignal.aborted).toBe(true))
      expect(f.application.downloadMessageMedia).not.toHaveBeenCalled()
    }
    finally {
      await runtime.close()
    }
  })
})
