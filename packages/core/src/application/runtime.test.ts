import type { Logger } from '@guiiai/logg'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { CoreContext } from '../context'
import type { Models } from '../models'
import type { EntityService } from '../services/entity'
import type { TakeoutService } from '../services/takeout'

import bigInt from 'big-integer'

import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { createTelegramApplicationRuntime } from './runtime'

function createTestLogger(): Logger {
  const logger: Record<string, unknown> = {}
  const chain = () => logger
  for (const method of ['withContext', 'withFields', 'withError', 'withLogLevel', 'withLogLevelString', 'useGlobalConfig'])
    logger[method] = chain
  for (const method of ['debug', 'verbose', 'log', 'warn', 'error'])
    logger[method] = () => {}
  return logger as unknown as Logger
}

function createHarness(messages: Api.Message[] = []) {
  const channel = new Api.Channel({
    id: bigInt(42),
    title: 'Persisted channel',
    accessHash: bigInt(99),
    broadcast: true,
    photo: new Api.ChatPhotoEmpty(),
    date: 0,
  })
  const inputPeer = new Api.InputPeerChannel({ channelId: bigInt(42), accessHash: bigInt(99) })
  const getDialogs = vi.fn(async (options: { limit?: number, offsetDate?: number }) => {
    // Regression: GramJS 2.26 returns an empty page when offsetDate: 0 is
    // supplied explicitly, even though the default call returns dialogs.
    return options.offsetDate === 0 ? [] : [{ entity: channel, message: undefined }]
  })
  const getMessages = vi.fn(async () => messages)
  const getEntity = vi.fn(async () => channel)
  const iterDialogs = vi.fn((options: { limit?: number, offsetDate?: number }): AsyncIterable<Dialog> => ({
    async* [Symbol.asyncIterator]() {
      yield* await getDialogs(options) as unknown as Dialog[]
    },
  }))
  const client = { getDialogs, iterDialogs, getMessages, getEntity }
  const recordChats = vi.fn(async () => [])
  const recordMessages = vi.fn(async () => [])
  const getInputPeer = vi.fn(async () => inputPeer)
  const takeoutMessages = vi.fn(async function* (
    _chatId: string,
    _options: Parameters<TakeoutService['takeoutMessages']>[1],
  ) {
    yield* messages
  })
  const context = {
    emitter: { emit: vi.fn() },
    getClient: () => client,
    getCurrentAccountId: () => 'account-1',
    getDB: () => ({}),
  } as unknown as CoreContext
  const models = {
    chatModels: { recordChats },
    chatMessageModels: { recordMessages },
  } as unknown as Models
  const entityService = { getInputPeer } as Pick<EntityService, 'getInputPeer'>
  const takeoutService = { takeoutMessages } as Pick<TakeoutService, 'takeoutMessages'>
  const logger = createTestLogger()

  return {
    channel,
    client,
    context,
    entityService,
    getDialogs,
    iterDialogs,
    getEntity,
    getInputPeer,
    getMessages,
    inputPeer,
    logger,
    models,
    recordChats,
    recordMessages,
    takeoutMessages,
    takeoutService,
  }
}

describe('telegram application runtime remote boundaries', () => {
  it('does not start a point-read RPC after cancellation while resolving its peer', async () => {
    // Point reads must check cancellation between peer resolution and fetching message IDs.
    const harness = createHarness()
    let releasePeer!: (peer: Api.InputPeerChannel) => void
    harness.getInputPeer.mockImplementationOnce(() => new Promise((resolve) => {
      releasePeer = resolve
    }))
    const runtime = createTelegramApplicationRuntime(harness)
    const controller = new AbortController()
    const pending = runtime.getMessages({ source: 'telegram', chatId: '42', messageIds: ['1'] }, { signal: controller.signal })
    await vi.waitFor(() => expect(harness.getInputPeer).toHaveBeenCalledOnce())
    controller.abort()
    expect(await pending).toMatchObject({ ok: false, error: { code: 'REQUEST_CANCELLED' } })
    releasePeer(harness.inputPeer)
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(harness.getMessages).not.toHaveBeenCalled()
  })

  it('bounds an explicit point read by its deadline while retaining the shared client', async () => {
    const harness = createHarness()
    const pending = new Promise<Api.Message[]>(() => {})
    harness.getMessages.mockReturnValueOnce(pending)
    const runtime = createTelegramApplicationRuntime(harness)
    const result = await runtime.getMessages({ source: 'telegram', chatId: '42', messageIds: ['1'], operation: { deadlineAt: Date.now() + 100 } })
    expect(result).toMatchObject({ ok: false, error: { code: 'REQUEST_DEADLINE_EXCEEDED', details: { sdkCancellation: 'unsupported', inFlightMayContinue: true } } })
    expect(harness.getMessages).toHaveBeenCalledTimes(1)
  })

  it('classifies a local window cursor error without querying or claiming exhaustion', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)
    const result = await runtime.readMessages({ source: 'local', chatId: '42', cursor: '9'.repeat(40), pageSize: 100, maxPages: 1, maxMessages: 100 })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })
    expect(harness.getMessages).not.toHaveBeenCalled()
  })

  it('lists dialogs without the epoch offset and persists their access hashes', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)

    const result = await runtime.listChats({ limit: 1 })

    expect(result).toMatchObject({ ok: true, data: { items: [{ id: '42' }] } })
    expect(harness.getDialogs).toHaveBeenCalledWith({ limit: 2 })
    expect(harness.recordChats).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ id: 42, accessHash: '99', type: 'channel' })],
      'account-1',
    )
  })

  it('stops dialog iteration after cancellation before requesting another page (issue #682)', async () => {
    // getDialogs() collects SDK pages internally and cannot observe our signal.
    // Owning public iterator.next() lets the application stop that pagination.
    const harness = createHarness()
    const controller = new AbortController()
    let settlePage!: (result: IteratorResult<Dialog>) => void
    const next = vi.fn<() => Promise<IteratorResult<Dialog>>>()
      .mockResolvedValueOnce({ done: false, value: { entity: harness.channel } as Dialog })
      .mockImplementationOnce(() => new Promise<IteratorResult<Dialog>>((resolve) => {
        settlePage = resolve
      }))
      .mockResolvedValue({ done: true, value: undefined })
    harness.iterDialogs.mockReturnValue({ [Symbol.asyncIterator]: () => ({ next }) })
    const runtime = createTelegramApplicationRuntime(harness)
    const pending = runtime.listChats({ limit: 300 }, { signal: controller.signal })
    try {
      await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(2))
      controller.abort()
      await expect(pending).resolves.toMatchObject({ ok: false, error: { code: 'REQUEST_CANCELLED', details: { sdkCancellation: 'unsupported', inFlightMayContinue: true } } })
      settlePage({ done: false, value: { entity: harness.channel } as Dialog })
      await new Promise<void>(resolve => queueMicrotask(resolve))
      expect(next).toHaveBeenCalledTimes(2)
      expect(harness.recordChats).not.toHaveBeenCalled()
    }
    finally {
      controller.abort()
      await pending
    }
  })

  it('resolves numeric chat IDs through the shared DB-backed entity service', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)

    const result = await runtime.listRemoteMessages({ chatId: '42', limit: 1 })

    expect(result).toMatchObject({ ok: true, data: { items: [] } })
    expect(harness.getInputPeer).toHaveBeenCalledWith('42')
    expect(harness.getMessages).toHaveBeenCalledWith(
      harness.inputPeer,
      expect.objectContaining({ limit: 1 }),
    )
  })

  it('passes a sender filter to Telegram for server-side message filtering', async () => {
    const harness = createHarness()
    harness.getMessages.mockResolvedValue(Object.assign([], { total: 321 }))
    const runtime = createTelegramApplicationRuntime(harness)

    const result = await runtime.listRemoteMessages({
      chatId: '42',
      fromUserId: 'me',
      limit: 100,
      to: 20,
    })

    expect(harness.getMessages).toHaveBeenCalledWith(
      harness.inputPeer,
      expect.objectContaining({ fromUser: 'me', limit: 100, offsetDate: 21 }),
    )
    expect(result).toMatchObject({ ok: true, data: { total: 321 } })
  })

  it('passes the newer-message anchor to GramJS', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)

    await runtime.listRemoteMessages({ chatId: '42', limit: 100, minMessageId: 77 })

    expect(harness.getMessages).toHaveBeenCalledWith(
      harness.inputPeer,
      expect.objectContaining({ minId: 77 }),
    )
  })

  it('preserves transient Telegram failures for the CLI retry boundary', async () => {
    const harness = createHarness()
    harness.getDialogs.mockRejectedValue({
      code: 500,
      errorMessage: 'RPC_CALL_FAIL',
      message: '500: RPC_CALL_FAIL',
    })
    const runtime = createTelegramApplicationRuntime(harness)

    const result = await runtime.listChats({ limit: 1 })

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'TELEGRAM_TRANSIENT', retryable: true },
    })
  })

  it('persists a resolved chat before recording its synced messages', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)

    const updates = []
    for await (const update of runtime.sync({ chatIds: ['public-channel'], all: false, limit: 1, takeout: true }))
      updates.push(update)

    expect(updates.at(-1)).toMatchObject({ type: 'completed', processed: 0 })
    expect(harness.getInputPeer).toHaveBeenCalledWith('public-channel')
    expect(harness.getEntity).toHaveBeenCalledWith(harness.inputPeer)
    expect(harness.recordChats).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ id: 42, accessHash: '99' })],
      'account-1',
    )
    expect(harness.recordChats.mock.invocationCallOrder[0]).toBeLessThan(
      harness.takeoutMessages.mock.invocationCallOrder[0],
    )
    expect(harness.takeoutMessages).toHaveBeenCalledWith(
      'public-channel',
      expect.objectContaining({ takeoutConsent: true }),
    )
  })

  it('lets GramJS paginate every dialog for an explicit sync --all', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)

    for await (const _update of runtime.sync({ chatIds: [], all: true, limit: 1, takeout: true })) {
      // Consume the stream so dialog discovery and sync complete.
    }

    expect(harness.getDialogs).toHaveBeenCalledWith({})
    expect(harness.takeoutMessages).toHaveBeenCalledWith('42', expect.anything())
  })

  it('fails closed when takeout consent is absent', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)

    const updates = []
    for await (const update of runtime.sync({ chatIds: ['public-channel'], all: false, limit: 1, takeout: false }))
      updates.push(update)

    expect(updates.at(-1)).toMatchObject({ type: 'failed', error: { code: 'TAKEOUT_CONSENT_REQUIRED' } })
    expect(harness.takeoutMessages).not.toHaveBeenCalled()
    expect(harness.getMessages).not.toHaveBeenCalled()
  })

  it('reports Telegram takeout delays as a user authorization requirement', async () => {
    const harness = createHarness()
    harness.takeoutMessages.mockImplementation(async function* (_chatId, options) {
      options.task.updateError(new Error('420: TAKEOUT_INIT_DELAY_86400 (caused by account.InitTakeoutSession)'))
      yield* []
    })
    const runtime = createTelegramApplicationRuntime(harness)

    const updates = []
    for await (const update of runtime.sync({ chatIds: ['public-channel'], all: false, limit: 1, takeout: true }))
      updates.push(update)

    expect(updates.at(-1)).toMatchObject({
      type: 'failed',
      error: {
        code: 'TAKEOUT_AUTHORIZATION_REQUIRED',
        message: expect.stringContaining('authorize the export request'),
        retryable: false,
        retryAfterSeconds: 86400,
        details: { action: 'authorize_takeout_in_telegram' },
      },
    })
    expect(harness.getMessages).not.toHaveBeenCalled()
  })

  it('reports Telegram flood waits from takeout without restarting the stream', async () => {
    const harness = createHarness()
    harness.takeoutMessages.mockImplementation(async function* (_chatId, options) {
      options.task.updateError({
        code: 420,
        errorMessage: 'FLOOD_WAIT_298',
        message: 'A wait of 298 seconds is required',
      })
      yield* []
    })
    const runtime = createTelegramApplicationRuntime(harness)

    const updates = []
    for await (const update of runtime.sync({ chatIds: ['public-channel'], all: false, limit: 1, takeout: true }))
      updates.push(update)

    expect(updates.at(-1)).toMatchObject({
      type: 'failed',
      error: {
        code: 'TELEGRAM_FLOOD_WAIT',
        retryable: true,
        retryAfterSeconds: 298,
      },
    })
    expect(harness.takeoutMessages).toHaveBeenCalledOnce()
  })

  it('stores jieba tokens so synced text is searchable', async () => {
    const message = new Api.Message({
      id: 7,
      peerId: new Api.PeerChannel({ channelId: bigInt(42) }),
      fromId: new Api.PeerUser({ userId: bigInt(8) }),
      date: 1_700_000_000,
      message: '中文搜索回归测试',
    })
    const harness = createHarness([message])
    const runtime = createTelegramApplicationRuntime(harness)

    for await (const _update of runtime.sync({ chatIds: ['public-channel'], all: false, limit: 1, takeout: true })) {
      // Consume the stream so the sync completes.
    }

    expect(harness.recordMessages).toHaveBeenCalledWith(
      expect.anything(),
      'account-1',
      [expect.objectContaining({ jiebaTokens: expect.arrayContaining(['中文', '搜索']) })],
    )
  })

  // Regression: static export.ts import pulled node:crypto into Vite browser boot.
  it('omits exportLocal in browser runtimes', () => {
    const originalWindow = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = {}
    try {
      const runtime = createTelegramApplicationRuntime(createHarness())
      expect(runtime.exportLocal).toBeUndefined()
    }
    finally {
      if (originalWindow === undefined)
        delete (globalThis as { window?: unknown }).window
      else
        (globalThis as { window?: unknown }).window = originalWindow
    }
  })

  it('exposes exportLocal in Node runtimes', () => {
    const runtime = createTelegramApplicationRuntime(createHarness())
    expect(runtime.exportLocal).toEqual(expect.any(Function))
  })
})
