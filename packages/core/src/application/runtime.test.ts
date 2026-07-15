import type { Logger } from '@guiiai/logg'

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
  const client = { getDialogs, getMessages, getEntity }
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

  it('resolves numeric chat IDs through the shared DB-backed entity service', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)

    const result = await runtime.listRemoteMessages({ chatId: '42', limit: 1 })

    expect(result).toMatchObject({ ok: true, data: { items: [] } })
    expect(harness.getInputPeer).toHaveBeenCalledWith('42')
    expect(harness.getMessages).toHaveBeenCalledWith(
      harness.inputPeer,
      expect.objectContaining({ limit: 2 }),
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
      expect.objectContaining({ fromUser: 'me', limit: 101, offsetDate: 21 }),
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

  it('reports Telegram takeout delays as retryable structured errors', async () => {
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
        code: 'TAKEOUT_INIT_DELAY',
        retryable: true,
        retryAfterSeconds: 86400,
      },
    })
    expect(harness.getMessages).not.toHaveBeenCalled()
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
})
