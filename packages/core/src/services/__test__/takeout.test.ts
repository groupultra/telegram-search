import type { CoreContext, CoreEmitter } from '../../context'
import type { CoreDB } from '../../db'
import type { AccountSettings } from '../../types/account-settings'
import type { CoreUserEntity, FromCoreEvent, ToCoreEvent } from '../../types/events'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { CoreEventType } from '../../types/events'
import { createTask as createCoreTask } from '../../utils/task'
import { createTakeoutService } from '../takeout'

const mockWaiter = vi.fn(async (_signal?: AbortSignal) => {})
const logger = useLogger()

const mockChatModels = {
  fetchChatsByAccountId: vi.fn(),
} as any

const mockChatMessageStatsModels = {
  getChatMessageStatsByChatId: vi.fn(),
} as any

const mockEntityService = {
  getInputPeer: vi.fn(async () => new Api.InputPeerChat({ chatId: bigInt(123) })),
} as any

vi.mock('../../utils/min-interval', () => {
  return {
    createMinIntervalWaiter: () => mockWaiter,
  }
})

function createMockCtx(client: any) {
  const withError = vi.fn((error: unknown) => (error instanceof Error ? error : new Error(String(error))))

  // Minimal event emitter stub for processMessageBatch/runTakeout flows.
  const handlers = new Map<string, Set<(...args: any[]) => void>>()
  const emitter = {
    on: vi.fn((event: string, handler: (...args: any[]) => void) => {
      const set = handlers.get(event) ?? new Set()
      set.add(handler)
      handlers.set(event, set)
    }),
    once: vi.fn((event: string, handler: (...args: any[]) => void) => {
      const wrapped = (...args: any[]) => {
        handlers.get(event)?.delete(wrapped)
        handler(...args)
      }
      const set = handlers.get(event) ?? new Set()
      set.add(wrapped)
      handlers.set(event, set)
    }),
    off: vi.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.get(event)?.delete(handler)
    }),
    emit: vi.fn((event: string, payload: any) => {
      handlers.get(event)?.forEach(fn => fn(payload))
    }),
  } as unknown as CoreEmitter

  const ctx: CoreContext = {
    emitter,
    toCoreEvents: new Set<keyof ToCoreEvent>(),
    fromCoreEvents: new Set<keyof FromCoreEvent>(),
    wrapEmitterEmit: () => {},
    wrapEmitterOn: () => {},
    setClient: () => {},
    getClient: () => client,
    setCurrentAccountId: () => {},
    getCurrentAccountId: () => 'acc-1',
    getDB: () => ({} as unknown as CoreDB),
    withError,
    cleanup: () => {},
    setMyUser: () => {},
    getMyUser: () => ({}) as unknown as CoreUserEntity,
    getAccountSettings: async () => ({}) as unknown as AccountSettings,
    setAccountSettings: async () => {},
    metrics: undefined,
  }

  return { ctx, withError }
}

function createTask() {
  // Minimal emitter stub for CoreTask -> task.ts only calls emitter.emit(...)
  const emitter = { emit: vi.fn() } as unknown as CoreEmitter
  return createCoreTask('takeout', { chatIds: ['123'] }, emitter, logger)
}

describe('takeout service', () => {
  it('getTotalMessageCount should return count from telegram history', async () => {
    const client = {
      invoke: vi.fn(async (query: any) => {
        if (query instanceof Api.messages.GetHistory) {
          return {
            count: 123,
            messages: [],
          }
        }
        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)

    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const count = await service.getTotalMessageCount('123')

    expect(count).toBe(123)
  })

  it('getTotalMessageCount should return 0 on failure', async () => {
    const client = {
      invoke: vi.fn(async () => {
        throw new Error('fail')
      }),
    }

    const { ctx } = createMockCtx(client)

    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const count = await service.getTotalMessageCount('123')

    expect(count).toBe(0)
  })

  it('takeoutMessages should yield messages, skip MessageEmpty, and finish successfully', async () => {
    const calls: any[] = []

    const client = {
      getInputEntity: vi.fn(async (_chatId: string) => ({})),
      invoke: vi.fn(async (query: any) => {
        calls.push(query)

        if (query instanceof Api.account.InitTakeoutSession) {
          return { id: bigInt(1) }
        }

        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        }

        if (query instanceof Api.InvokeWithTakeout) {
          const rangeWrapper = (query).query
          if (rangeWrapper instanceof Api.InvokeWithMessagesRange) {
            const inner = rangeWrapper.query
            if (inner instanceof Api.messages.GetHistory) {
              // First page has 3 results (one empty), second is boundary.
              if ((inner).offsetId === 0) {
                return {
                  messages: [
                    new Api.MessageEmpty({ id: 1 }),
                    new Api.MessageService({
                      id: 4,
                      peerId: new Api.PeerChat({ chatId: bigInt(123) }),
                      date: 1,
                      action: new Api.MessageActionChatCreate({ title: 'Created', users: [] }),
                    }),
                    { id: 2 },
                    { id: 3 },
                  ],
                }
              }
              return { messages: [] }
            }
          }

          if (rangeWrapper instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)

    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const task = createTask()
    task.updateProgress = vi.fn()
    task.updateError = vi.fn()

    const yielded: any[] = []
    for await (const m of service.takeoutMessages('123', {
      pagination: { limit: 100, offset: 0 },
      minId: 0,
      maxId: 0,
      skipMedia: true,
      task,
      expectedCount: 3,
      disableAutoProgress: false,
      syncOptions: undefined,
      takeoutConsent: true,
    })) {
      yielded.push(m)
    }

    expect(yielded.map(m => m.id)).toEqual([2, 3])

    const init = calls.find(query => query instanceof Api.account.InitTakeoutSession) as Api.account.InitTakeoutSession
    expect(init).toMatchObject({
      contacts: false,
      files: false,
      messageChats: true,
      messageMegagroups: true,
    })
    expect(init.messageUsers).toBeUndefined()
    expect(init.messageChannels).toBeUndefined()
    expect(init.fileMaxSize).toBeUndefined()

    const splitRanges = calls.find(query => query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges)
    expect(splitRanges).toBeInstanceOf(Api.InvokeWithTakeout)

    const history = calls
      .filter((query): query is Api.InvokeWithTakeout => query instanceof Api.InvokeWithTakeout)
      .map(query => query.query)
      .filter((query): query is Api.InvokeWithMessagesRange => query instanceof Api.InvokeWithMessagesRange)
      .map(query => query.query)
      .find((query): query is Api.messages.GetHistory => query instanceof Api.messages.GetHistory)
    expect(history?.hash.equals(bigInt.zero)).toBe(true)

    // Init + get messages + final complete
    expect(task.updateProgress).toHaveBeenCalledWith(0, 'Init takeout session')
    expect(task.updateProgress).toHaveBeenCalledWith(0, 'Get messages')
    expect(task.updateProgress).toHaveBeenCalledWith(100)

    // Ensure we finished session successfully.
    const finished = calls.find(q => q instanceof Api.InvokeWithTakeout && (q).query instanceof Api.account.FinishTakeoutSession)
    expect(finished).toBeTruthy()
    expect((finished).query.success).toBe(true)
  })

  it('takeoutMessages should request only the selected megagroup data category', async () => {
    let init: Api.account.InitTakeoutSession | undefined
    const channel = new Api.Channel({
      id: bigInt(42),
      accessHash: bigInt(99),
      title: 'Megagroup',
      photo: new Api.ChatPhotoEmpty(),
      date: 0,
      megagroup: true,
    })
    const client = {
      getEntity: vi.fn(async () => channel),
      invoke: vi.fn(async (query: Api.AnyRequest) => {
        if (query instanceof Api.account.InitTakeoutSession) {
          init = query
          throw new Error('stop after scope assertion')
        }
        throw new Error('unexpected query')
      }),
    }
    const entityService = {
      getInputPeer: vi.fn(async () => new Api.InputPeerChannel({ channelId: bigInt(42), accessHash: bigInt(99) })),
    }
    const { ctx } = createMockCtx(client)
    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, entityService as any)
    const task = createTask()

    for await (const _message of service.takeoutMessages('42', {
      pagination: { limit: 100, offset: 0 },
      skipMedia: true,
      takeoutConsent: true,
      task,
    })) {
      // Init is expected to fail before any message can be yielded.
    }

    expect(init).toMatchObject({ contacts: false, files: false, messageMegagroups: true })
    expect(init?.messageUsers).toBeUndefined()
    expect(init?.messageChats).toBeUndefined()
    expect(init?.messageChannels).toBeUndefined()
    expect(init?.fileMaxSize).toBeUndefined()
  })

  it('takeoutMessages should finish unsuccessfully when its consumer stops early', async () => {
    const calls: Api.AnyRequest[] = []
    const client = {
      invoke: vi.fn(async (query: Api.AnyRequest) => {
        calls.push(query)
        if (query instanceof Api.account.InitTakeoutSession)
          return { id: bigInt(1) }
        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges)
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        if (query instanceof Api.InvokeWithTakeout) {
          if (query.query instanceof Api.account.FinishTakeoutSession)
            return {}
          return { messages: [{ id: 1, date: 1 }] }
        }
        throw new Error('unexpected query')
      }),
    }
    const { ctx } = createMockCtx(client)
    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const task = createTask()

    const generator = service.takeoutMessages('123', {
      pagination: { limit: 100, offset: 0 },
      skipMedia: true,
      expectedCount: 1,
      takeoutConsent: true,
      task,
    })
    await expect(generator.next()).resolves.toMatchObject({ done: false, value: { id: 1 } })
    await generator.return(undefined)

    const finished = calls.find(query => query instanceof Api.InvokeWithTakeout && query.query instanceof Api.account.FinishTakeoutSession)
    expect(finished).toBeInstanceOf(Api.InvokeWithTakeout)
    expect(((finished as Api.InvokeWithTakeout).query as Api.account.FinishTakeoutSession).success).toBe(false)
  })

  it('takeoutMessages should accept millisecond startTime and filter correctly', async () => {
    const startSec = 1_577_836_800 // 2020-01-01T00:00:00Z
    const startMs = startSec * 1000

    const client = {
      getInputEntity: vi.fn(async (_chatId: string) => ({})),
      invoke: vi.fn(async (query: any) => {
        if (query instanceof Api.account.InitTakeoutSession) {
          return { id: bigInt(1) }
        }

        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        }

        if (query instanceof Api.InvokeWithTakeout) {
          const rangeWrapper = (query).query
          if (rangeWrapper instanceof Api.InvokeWithMessagesRange) {
            const inner = rangeWrapper.query
            if (inner instanceof Api.messages.GetHistory) {
              if ((inner).offsetId === 0) {
                return {
                  messages: [
                    { id: 30, date: startSec + 100 },
                    { id: 29, date: startSec },
                    { id: 28, date: startSec - 100 },
                  ],
                }
              }
              return { messages: [] }
            }
          }

          if (rangeWrapper instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)

    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const task = createTask()
    task.updateProgress = vi.fn()
    task.updateError = vi.fn()

    const yielded: any[] = []
    for await (const m of service.takeoutMessages('123', {
      pagination: { limit: 100, offset: 0 },
      minId: 0,
      maxId: 0,
      startTime: startMs,
      skipMedia: true,
      task,
      expectedCount: 3,
      disableAutoProgress: true,
      syncOptions: undefined,
      takeoutConsent: true,
    })) {
      yielded.push(m)
    }

    expect(yielded.map(m => m.id)).toEqual([30, 29])
    expect(task.updateError).not.toHaveBeenCalled()
  })

  it('takeoutMessages should reject missing consent before calling Telegram', async () => {
    const client = { invoke: vi.fn() }
    const { ctx } = createMockCtx(client)
    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const task = createTask()

    const yielded: Api.Message[] = []
    for await (const message of service.takeoutMessages('123', {
      pagination: { limit: 100, offset: 0 },
      skipMedia: true,
      task,
      takeoutConsent: false,
    })) {
      yielded.push(message)
    }

    expect(yielded).toEqual([])
    expect(task.state.lastError).toBe('Explicit Telegram Takeout consent is required')
    expect(client.invoke).not.toHaveBeenCalled()
  })

  it('takeoutMessages should fail closed when takeout initialization fails', async () => {
    const calls: any[] = []

    const client = {
      getInputEntity: vi.fn(async () => ({})),
      invoke: vi.fn(async (query: any) => {
        calls.push(query)

        if (query instanceof Api.account.InitTakeoutSession) {
          throw new TypeError('init failed')
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)

    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const task = createTask()
    task.updateProgress = vi.fn()
    task.updateError = vi.fn()

    const yielded: any[] = []
    for await (const m of service.takeoutMessages('123', {
      pagination: { limit: 100, offset: 0 },
      minId: 0,
      maxId: 0,
      skipMedia: true,
      task,
      expectedCount: 2,
      disableAutoProgress: false,
      syncOptions: undefined,
      takeoutConsent: true,
    })) {
      yielded.push(m)
    }

    expect(yielded).toEqual([])
    expect(task.updateError).toHaveBeenCalledWith(expect.objectContaining({ message: 'init failed' }))
    expect(calls).toHaveLength(1)
  })

  it('takeoutMessages should finish late takeout session when init times out', async () => {
    vi.useFakeTimers()
    // Init can time out locally while Telegram still creates a session later.
    // We must finish that late session to avoid leaking takeout sessions.
    const calls: any[] = []
    let resolveInitTakeout: ((value: { id: ReturnType<typeof bigInt> }) => void) | undefined

    const client = {
      invoke: vi.fn((query: any) => {
        calls.push(query)

        if (query instanceof Api.account.InitTakeoutSession) {
          return new Promise((resolve) => {
            resolveInitTakeout = resolve
          })
        }

        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        }

        if (query instanceof Api.InvokeWithTakeout) {
          const inner = (query).query
          if (inner instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    try {
      const { ctx } = createMockCtx(client)
      const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
      const task = createTask()
      task.updateProgress = vi.fn()
      task.updateError = vi.fn()

      const collectPromise = (async () => {
        const yielded: any[] = []
        for await (const m of service.takeoutMessages('123', {
          pagination: { limit: 100, offset: 0 },
          minId: 0,
          maxId: 0,
          skipMedia: true,
          task,
          expectedCount: 1,
          disableAutoProgress: false,
          syncOptions: undefined,
          takeoutConsent: true,
        })) {
          yielded.push(m)
        }
        return yielded
      })()

      await vi.advanceTimersByTimeAsync(30_000)
      const yielded = await collectPromise

      expect(yielded).toEqual([])
      expect(task.updateError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Takeout session init timed out after 30s' }))

      // Resolve the late init after timeout and ensure cleanup finish(false) happens.
      resolveInitTakeout?.({ id: bigInt(99) })
      await Promise.resolve()
      await Promise.resolve()

      const lateFinishCall = calls.find(q => q instanceof Api.InvokeWithTakeout && q.takeoutId.toString() === '99')
      expect(lateFinishCall).toBeTruthy()
      expect((lateFinishCall).query).toBeInstanceOf(Api.account.FinishTakeoutSession)
      expect((lateFinishCall).query.success).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('takeoutMessages should report init failure without fallback progress', async () => {
    const client = {
      invoke: vi.fn(async (query: any) => {
        if (query instanceof Api.account.InitTakeoutSession) {
          throw new TypeError('init failed')
        }
        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        }
        if (query instanceof Api.InvokeWithMessagesRange) {
          const inner = query.query
          if (inner instanceof Api.messages.GetHistory) {
            return { messages: [] }
          }
        }
        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)
    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const task = createTask()
    task.updateProgress = vi.fn()

    for await (const message of service.takeoutMessages('123', {
      pagination: { limit: 100, offset: 0 },
      minId: 0,
      maxId: 0,
      skipMedia: true,
      task,
      expectedCount: 0,
      disableAutoProgress: true,
      syncOptions: undefined,
      takeoutConsent: true,
    })) {
      void message
    }

    expect(task.updateProgress).not.toHaveBeenCalledWith(0, 'Takeout unavailable, using regular sync')
    expect(task.state.lastError).toBe('init failed')
  })

  it('takeoutMessages should stop when aborted during rate-limit wait', async () => {
    const waiter = vi.fn(async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        throw new Error('aborted')
      }
    })

    mockWaiter.mockImplementation(waiter)

    const calls: any[] = []

    const client = {
      getInputEntity: vi.fn(async (_chatId: string) => ({})),
      invoke: vi.fn(async (query: any) => {
        calls.push(query)

        if (query instanceof Api.account.InitTakeoutSession) {
          return { id: bigInt(1) }
        }

        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        }

        if (query instanceof Api.InvokeWithTakeout) {
          const rangeWrapper = (query).query
          if (rangeWrapper instanceof Api.InvokeWithMessagesRange) {
            const inner = rangeWrapper.query
            if (inner instanceof Api.messages.GetHistory) {
              return {
                messages: [{ id: 1 }],
              }
            }
          }
          if (rangeWrapper instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)

    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const task = createTask()

    // Abort before iteration begins so waitHistoryInterval throws.
    task.state.abortController.abort()

    const yielded: any[] = []
    for await (const m of service.takeoutMessages('123', {
      pagination: { limit: 100, offset: 0 },
      minId: 0,
      maxId: 0,
      skipMedia: true,
      task,
      expectedCount: 10,
      disableAutoProgress: false,
      syncOptions: undefined,
      takeoutConsent: true,
    })) {
      yielded.push(m)
    }

    expect(yielded).toEqual([])

    // Aborted exports must close the takeout session as unsuccessful.
    const finished = calls.find(q => q instanceof Api.InvokeWithTakeout && (q).query instanceof Api.account.FinishTakeoutSession)
    expect(finished).toBeTruthy()
    expect((finished).query.success).toBe(false)
  })

  it('runTakeout should normalize string IDs from stats/syncOptions to numbers', async () => {
    const historyCalls: Api.messages.GetHistory[] = []

    mockChatModels.fetchChatsByAccountId.mockReset()
    mockChatMessageStatsModels.getChatMessageStatsByChatId.mockReset()

    mockChatMessageStatsModels.getChatMessageStatsByChatId.mockResolvedValue({
      unwrap: () => ({
        message_count: 5,
        // Simulate bigint/text coming back as strings from DB driver.
        first_message_id: '561',
        latest_message_id: '3894496',
      }),
    })

    const client = {
      getInputEntity: vi.fn(async (_chatId: string) => ({})),
      invoke: vi.fn(async (query: any) => {
        // Count query (not wrapped in takeout).
        if (query instanceof Api.messages.GetHistory) {
          return { count: 10, messages: [] }
        }

        if (query instanceof Api.account.InitTakeoutSession) {
          return { id: bigInt(1) }
        }

        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        }

        if (query instanceof Api.InvokeWithTakeout) {
          const maybeRange = (query).query
          if (maybeRange instanceof Api.InvokeWithMessagesRange) {
            const inner = maybeRange.query
            if (inner instanceof Api.messages.GetHistory) {
              historyCalls.push(inner)

              // Return one message for the first backward page, then end.
              if ((inner).offsetId === 0) {
                return { messages: [{ id: 3894497 }] }
              }
              return { messages: [] }
            }
          }

          if (maybeRange instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)

    // Auto-respond to takeout confirmation prompt. Must be async so that
    // waitForEvent registers its once() listener before we emit the response.
    ctx.emitter.on(CoreEventType.TakeoutConfirmNeeded, () => {
      queueMicrotask(() => {
        ctx.emitter.emit(CoreEventType.TakeoutConfirmResponse, { useTakeout: true })
      })
    })

    // Auto-complete message processing batches to avoid hanging on pendingBatches.
    ctx.emitter.on(CoreEventType.MessageProcess, ({ messages, batchId }) => {
      ctx.emitter.emit(CoreEventType.MessageProcessed, {
        batchId: batchId ?? 'batch-id',
        count: messages.length,
        resolverSpans: [],
      })
    })

    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)

    await service.runTakeout({
      chatIds: ['123'],
      increase: true,
      // Simulate sync options coming in as stringly typed IDs.
      syncOptions: {
        minMessageId: '3894496' as unknown as number,
        maxMessageId: '0' as unknown as number,
      },
    })

    // Ensure we made at least one takeout history call.
    expect(historyCalls.length).toBeGreaterThan(0)

    // All history queries should have numeric IDs after normalization.
    for (const call of historyCalls) {
      expect(typeof call.minId).toBe('number')
      expect(typeof call.maxId).toBe('number')
      expect(typeof call.offsetId).toBe('number')
    }
  })

  it('takeoutMessages should iterate all split ranges and yield messages from each', async () => {
    // Verifies that messages from different split ranges (message boxes) are all
    // fetched. Without InvokeWithMessagesRange, messages beyond 500K/1M
    // boundaries would be silently missed.
    const rangesSeen: number[] = []

    const client = {
      getInputEntity: vi.fn(async (_chatId: string) => ({})),
      invoke: vi.fn(async (query: any) => {
        if (query instanceof Api.account.InitTakeoutSession) {
          return { id: bigInt(1) }
        }

        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [
            new Api.MessageRange({ minId: 1, maxId: 500000 }),
            new Api.MessageRange({ minId: 500001, maxId: 1000000 }),
          ]
        }

        if (query instanceof Api.InvokeWithTakeout) {
          const rangeWrapper = (query).query
          if (rangeWrapper instanceof Api.InvokeWithMessagesRange) {
            rangesSeen.push(rangeWrapper.range.minId)
            const inner = rangeWrapper.query
            if (inner instanceof Api.messages.GetHistory) {
              // Return different messages per range
              if (rangeWrapper.range.minId === 1) {
                if ((inner).offsetId === 0) {
                  return { messages: [{ id: 100 }, { id: 200 }] }
                }
                return { messages: [] }
              }
              if (rangeWrapper.range.minId === 500001) {
                if ((inner).offsetId === 0) {
                  return { messages: [{ id: 500100 }, { id: 500200 }] }
                }
                return { messages: [] }
              }
            }
          }
          if (rangeWrapper instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)
    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)
    const task = createTask()
    task.updateProgress = vi.fn()
    task.updateError = vi.fn()

    const yielded: any[] = []
    for await (const m of service.takeoutMessages('123', {
      pagination: { limit: 100, offset: 0 },
      minId: 0,
      maxId: 0,
      skipMedia: true,
      task,
      expectedCount: 4,
      disableAutoProgress: false,
      syncOptions: undefined,
      takeoutConsent: true,
    })) {
      yielded.push(m)
    }

    // Both ranges should have been visited
    expect(rangesSeen).toContain(1)
    expect(rangesSeen).toContain(500001)

    // Messages from both ranges should be yielded
    expect(yielded.map(m => m.id)).toEqual([100, 200, 500100, 500200])
    expect(task.updateError).not.toHaveBeenCalled()
    expect(task.updateProgress).toHaveBeenCalledWith(100)
  })

  it('runTakeout should include the initial synced count in takeout task metadata', async () => {
    mockChatMessageStatsModels.getChatMessageStatsByChatId.mockReset()
    mockChatMessageStatsModels.getChatMessageStatsByChatId.mockResolvedValue({
      unwrap: () => ({
        message_count: 123,
        first_message_id: 1,
        latest_message_id: 123,
      }),
    })

    const client = {
      getInputEntity: vi.fn(async (_chatId: string) => ({})),
      invoke: vi.fn(async (query: any) => {
        if (query instanceof Api.messages.GetHistory) {
          return { count: 200, messages: [] }
        }

        if (query instanceof Api.account.InitTakeoutSession) {
          return { id: bigInt(1) }
        }

        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        }

        if (query instanceof Api.InvokeWithTakeout) {
          const rangeWrapper = query.query
          if (rangeWrapper instanceof Api.InvokeWithMessagesRange) {
            const inner = rangeWrapper.query
            if (inner instanceof Api.messages.GetHistory) {
              return { messages: [] }
            }
          }

          if (rangeWrapper instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)
    let firstProgressPayload: any

    ctx.emitter.on(CoreEventType.TakeoutConfirmNeeded, () => {
      queueMicrotask(() => {
        ctx.emitter.emit(CoreEventType.TakeoutConfirmResponse, { useTakeout: true })
      })
    })

    ctx.emitter.on(CoreEventType.TakeoutTaskProgress, (data) => {
      firstProgressPayload ??= data
    })

    const service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)

    await service.runTakeout({
      chatIds: ['123'],
      increase: true,
      syncOptions: {},
    })

    expect(firstProgressPayload?.metadata.initialSyncedMessages).toBe(123)
  })

  it('runTakeout should stop the remaining chats after aborting the current task', async () => {
    mockChatMessageStatsModels.getChatMessageStatsByChatId.mockReset()
    mockChatMessageStatsModels.getChatMessageStatsByChatId.mockImplementation(async (_db: any, _accountId: any, chatId: string) => ({
      unwrap: () => ({
        message_count: 0,
        first_message_id: 0,
        latest_message_id: 0,
        chatId,
      }),
    }))

    const client = {
      getInputEntity: vi.fn(async (_chatId: string) => ({})),
      invoke: vi.fn(async (query: any) => {
        if (query instanceof Api.messages.GetHistory) {
          return { count: 1, messages: [] }
        }

        if (query instanceof Api.account.InitTakeoutSession) {
          return { id: bigInt(1) }
        }

        if (query instanceof Api.InvokeWithTakeout && query.query instanceof Api.messages.GetSplitRanges) {
          return [new Api.MessageRange({ minId: 1, maxId: 1000000 })]
        }

        if (query instanceof Api.InvokeWithTakeout) {
          const rangeWrapper = query.query
          if (rangeWrapper instanceof Api.InvokeWithMessagesRange) {
            const inner = rangeWrapper.query
            if (inner instanceof Api.messages.GetHistory) {
              if (inner.offsetId === 0) {
                return { messages: [{ id: 1 }] }
              }
              return { messages: [] }
            }
          }

          if (rangeWrapper instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)
    let service: ReturnType<typeof createTakeoutService>

    ctx.emitter.on(CoreEventType.TakeoutConfirmNeeded, () => {
      queueMicrotask(() => {
        ctx.emitter.emit(CoreEventType.TakeoutConfirmResponse, { useTakeout: true })
      })
    })

    ctx.emitter.on(CoreEventType.TakeoutTaskProgress, (data) => {
      if (data.metadata.chatIds[0] === 'chat-1' && data.progress >= 0) {
        service.abortTask(data.taskId)
      }
    })

    ctx.emitter.on(CoreEventType.MessageProcess, ({ messages, batchId }) => {
      ctx.emitter.emit(CoreEventType.MessageProcessed, {
        batchId: batchId ?? 'batch-id',
        count: messages.length,
        resolverSpans: [],
      })
    })

    service = createTakeoutService(ctx, logger, mockChatModels, mockChatMessageStatsModels, mockEntityService)

    await service.runTakeout({
      chatIds: ['chat-1', 'chat-2'],
      increase: false,
      syncOptions: {},
    })

    expect(mockChatMessageStatsModels.getChatMessageStatsByChatId.mock.calls.map((call: any[]) => call[2])).toEqual(['chat-1'])
  })
})
