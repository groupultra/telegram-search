import type { DBSelectAccount } from '../models/utils/types'

import bigInt from 'big-integer'

import { Ok } from '@unbird/result'
import { EventEmitter } from 'eventemitter3'
import { Api } from 'telegram'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { accountModels } from '../models/accounts'
import { chatMessageModels } from '../models/chat-message'
import { chatModels } from '../models/chats'
import { CoreEventType } from '../types/events'
import { createSyncService } from './sync'

function logger() {
  const instance = {
    withContext: vi.fn(),
    withFields: vi.fn(),
    withError: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
  instance.withContext.mockReturnValue(instance)
  instance.withFields.mockReturnValue(instance)
  instance.withError.mockReturnValue(instance)
  return instance
}

function account(overrides: Partial<DBSelectAccount> = {}): DBSelectAccount {
  return {
    id: 'account-1',
    platform: 'telegram',
    platform_user_id: 'user-1',
    settings: null,
    pts: 10,
    qts: 1,
    seq: 1,
    date: 100,
    last_sync_at: 0,
    created_at: 1,
    updated_at: 1,
    ...overrides,
  }
}

function state(pts: number): Api.updates.State {
  return new Api.updates.State({ pts, qts: 1, seq: 1, date: 100, unreadCount: 0 })
}

function message(id: number, text = 'message'): Api.Message {
  return new Api.Message({
    id,
    peerId: new Api.PeerUser({ userId: bigInt(42) }),
    date: 100,
    message: text,
  })
}

function harness(invoke: (request: unknown) => Promise<unknown>) {
  const emitter = new EventEmitter()
  const context = {
    emitter,
    getClient: () => ({ invoke }),
    getCurrentAccountId: () => 'account-1',
    getDB: () => ({}),
    withError: vi.fn(error => error instanceof Error ? error : new Error(String(error))),
  }
  return { context, emitter, service: createSyncService(context as never, logger() as never) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sync catch-up checkpoints', () => {
  it('emits idle when the account has no pts gap', async () => {
    vi.spyOn(accountModels, 'findAccountByUUID').mockResolvedValue(Ok(account()) as never)
    vi.spyOn(chatModels, 'fetchChatsByAccountId').mockResolvedValue(Ok([]) as never)
    const { emitter, service } = harness(async request => request instanceof Api.updates.GetState ? state(10) : undefined)
    const statuses: string[] = []
    emitter.on(CoreEventType.SyncStatus, ({ status }) => statuses.push(status))

    await service.catchUp()

    expect(statuses).toEqual(['syncing', 'idle'])
  })

  it('persists recovered messages, edits, and deletes before advancing pts', async () => {
    const updateState = vi.spyOn(accountModels, 'updateAccountState').mockResolvedValue(Ok(account({ pts: 20 })) as never)
    vi.spyOn(accountModels, 'findAccountByUUID').mockResolvedValue(Ok(account()) as never)
    vi.spyOn(chatModels, 'fetchChatsByAccountId').mockResolvedValue(Ok([]) as never)
    const softDelete = vi.spyOn(chatMessageModels, 'softDeleteMessages').mockResolvedValue(1)
    const edited = message(2, 'edited')
    const difference = new Api.updates.Difference({
      newMessages: [message(1)],
      newEncryptedMessages: [],
      otherUpdates: [
        new Api.UpdateEditMessage({ message: edited, pts: 19, ptsCount: 1 }),
        new Api.UpdateDeleteMessages({ messages: [3], pts: 20, ptsCount: 1 }),
      ],
      chats: [],
      users: [],
      state: state(20),
    })
    const { emitter, service } = harness(async (request) => {
      if (request instanceof Api.updates.GetState)
        return state(20)
      if (request instanceof Api.updates.GetDifference)
        return difference
      throw new Error('Unexpected request')
    })
    const recoveredBatches: Api.Message[][] = []
    emitter.on(CoreEventType.MessageProcess, (batch) => {
      recoveredBatches.push(batch.messages)
      expect(updateState).not.toHaveBeenCalled()
      emitter.emit(CoreEventType.MessageProcessed, {
        batchId: batch.batchId!,
        count: batch.messages.length,
        resolverSpans: [],
      })
    })

    await service.catchUp()

    expect(recoveredBatches[0].map(item => item.id)).toEqual([1, 2])
    expect(softDelete).toHaveBeenCalledWith(expect.anything(), 'account-1', ['3'])
    expect(updateState).toHaveBeenCalledWith(expect.anything(), 'account-1', expect.objectContaining({ pts: 20 }))
  })

  it('preserves the checkpoint when the account difference is too long', async () => {
    const updateState = vi.spyOn(accountModels, 'updateAccountState').mockResolvedValue(Ok(account()) as never)
    vi.spyOn(accountModels, 'findAccountByUUID').mockResolvedValue(Ok(account()) as never)
    const { emitter, service } = harness(async (request) => {
      if (request instanceof Api.updates.GetState)
        return state(100)
      return new Api.updates.DifferenceTooLong({ pts: 100 })
    })
    const statuses: string[] = []
    const takeout = vi.fn()
    emitter.on(CoreEventType.SyncStatus, ({ status }) => statuses.push(status))
    emitter.on(CoreEventType.TakeoutRun, takeout)

    await service.catchUp()

    expect(statuses).toEqual(['syncing', 'error'])
    expect(updateState).not.toHaveBeenCalled()
    expect(takeout).not.toHaveBeenCalled()
  })

  it('recovers channel messages before advancing the channel pts', async () => {
    vi.spyOn(accountModels, 'findAccountByUUID').mockResolvedValue(Ok(account()) as never)
    const updateChatPts = vi.spyOn(chatModels, 'updateChatPts').mockResolvedValue()
    vi.spyOn(chatModels, 'fetchChatsByAccountId').mockResolvedValue(Ok([{
      chat_id: '99',
      chat_type: 'channel',
      access_hash: '123',
      pts: 5,
    }]) as never)
    const channelMessage = new Api.Message({
      id: 7,
      peerId: new Api.PeerChannel({ channelId: bigInt(99) }),
      date: 100,
      message: 'channel message',
    })
    const { emitter, service } = harness(async (request) => {
      if (request instanceof Api.updates.GetState)
        return state(10)
      if (request instanceof Api.updates.GetChannelDifference) {
        return new Api.updates.ChannelDifference({
          final: true,
          pts: 8,
          newMessages: [channelMessage],
          otherUpdates: [],
          chats: [],
          users: [],
        })
      }
      throw new Error('Unexpected request')
    })
    emitter.on(CoreEventType.MessageProcess, (batch) => {
      expect(updateChatPts).not.toHaveBeenCalled()
      emitter.emit(CoreEventType.MessageProcessed, {
        batchId: batch.batchId!,
        count: batch.messages.length,
        resolverSpans: [],
      })
    })

    await service.catchUp()

    expect(updateChatPts).toHaveBeenCalledWith(expect.anything(), 'account-1', '99', 8)
  })
})
