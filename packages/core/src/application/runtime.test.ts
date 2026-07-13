import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { Models } from '../models'
import type { EntityService } from '../services/entity'

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
  const getDialogs = vi.fn(async (options: { limit: number, offsetDate?: number }) => {
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
  const context = {
    getClient: () => client,
    getCurrentAccountId: () => 'account-1',
    getDB: () => ({}),
  } as unknown as CoreContext
  const models = {
    chatModels: { recordChats },
    chatMessageModels: { recordMessages },
  } as unknown as Models
  const entityService = { getInputPeer } as Pick<EntityService, 'getInputPeer'>
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

  it('persists a resolved chat before recording its synced messages', async () => {
    const harness = createHarness()
    const runtime = createTelegramApplicationRuntime(harness)

    const updates = []
    for await (const update of runtime.sync({ chatIds: ['public-channel'], all: false, limit: 1 }))
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
      harness.recordMessages.mock.invocationCallOrder[0],
    )
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

    for await (const _update of runtime.sync({ chatIds: ['public-channel'], all: false, limit: 1 })) {
      // Consume the stream so the sync completes.
    }

    expect(harness.recordMessages).toHaveBeenCalledWith(
      expect.anything(),
      'account-1',
      [expect.objectContaining({ jiebaTokens: expect.arrayContaining(['中文', '搜索']) })],
    )
  })
})
