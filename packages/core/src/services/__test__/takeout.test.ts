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
  getInputPeer: vi.fn(async (peerId: string | number) => ({ peerId })),
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

        if (query instanceof Api.InvokeWithTakeout) {
          const inner = (query).query
          if (inner instanceof Api.messages.GetHistory) {
            // First page has 3 results (one empty), second is boundary.
            if ((inner).offsetId === 0) {
              return {
                messages: [
                  new Api.MessageEmpty({ id: 1 }),
                  { id: 2 },
                  { id: 3 },
                ],
              }
            }
            return { messages: [] }
          }

          if (inner instanceof Api.account.FinishTakeoutSession) {
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
    })) {
      yielded.push(m)
    }

    expect(yielded.map(m => m.id)).toEqual([2, 3])

    // Init + get messages + final complete
    expect(task.updateProgress).toHaveBeenCalledWith(0, 'Init takeout session')
    expect(task.updateProgress).toHaveBeenCalledWith(0, 'Get messages')
    expect(task.updateProgress).toHaveBeenCalledWith(100)

    // Ensure we finished session successfully.
    const finished = calls.find(q => q instanceof Api.InvokeWithTakeout && (q).query instanceof Api.account.FinishTakeoutSession)
    expect(finished).toBeTruthy()
    expect((finished).query.success).toBe(true)
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

        if (query instanceof Api.InvokeWithTakeout) {
          const inner = (query).query
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

          if (inner instanceof Api.account.FinishTakeoutSession) {
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
    })) {
      yielded.push(m)
    }

    expect(yielded.map(m => m.id)).toEqual([30, 29])
    expect(task.updateError).not.toHaveBeenCalled()
  })

  it('takeoutMessages should fall back to regular GetHistory when initTakeout fails', async () => {
    // When initTakeout fails, the generator should NOT abort but instead
    // fall back to plain GetHistory calls (without InvokeWithTakeout wrapper).
    const calls: any[] = []

    const client = {
      getInputEntity: vi.fn(async () => ({})),
      invoke: vi.fn(async (query: any) => {
        calls.push(query)

        if (query instanceof Api.account.InitTakeoutSession) {
          throw new TypeError('init failed')
        }

        // Fallback path: plain GetHistory (not wrapped in InvokeWithTakeout)
        if (query instanceof Api.messages.GetHistory) {
          if ((query).offsetId === 0) {
            return { messages: [{ id: 10 }, { id: 11 }] }
          }
          return { messages: [] }
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
    })) {
      yielded.push(m)
    }

    // Messages should still be yielded via regular GetHistory fallback
    expect(yielded.map(m => m.id)).toEqual([10, 11])
    expect(task.updateError).not.toHaveBeenCalled()

    // No InvokeWithTakeout calls should have been made
    const takeoutCalls = calls.filter(q => q instanceof Api.InvokeWithTakeout)
    expect(takeoutCalls).toHaveLength(0)
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

        if (query instanceof Api.messages.GetHistory) {
          return { messages: [{ id: 88 }] }
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
        })) {
          yielded.push(m)
        }
        return yielded
      })()

      await vi.advanceTimersByTimeAsync(30_000)
      const yielded = await collectPromise

      expect(yielded.map(m => m.id)).toEqual([88])
      expect(task.updateError).not.toHaveBeenCalled()

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

  it('takeoutMessages should not emit fallback progress when auto progress is disabled', async () => {
    const client = {
      invoke: vi.fn(async (query: any) => {
        if (query instanceof Api.account.InitTakeoutSession) {
          throw new TypeError('init failed')
        }
        if (query instanceof Api.messages.GetHistory) {
          return { messages: [] }
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
    })) {
      void message
    }

    expect(task.updateProgress).not.toHaveBeenCalledWith(0, 'Takeout unavailable, using regular sync')
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

        if (query instanceof Api.InvokeWithTakeout) {
          const inner = (query).query
          if (inner instanceof Api.messages.GetHistory) {
            return {
              messages: [{ id: 1 }],
            }
          }
          if (inner instanceof Api.account.FinishTakeoutSession) {
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
    })) {
      yielded.push(m)
    }

    expect(yielded).toEqual([])

    // Should still finish takeout session successfully after breaking.
    const finished = calls.find(q => q instanceof Api.InvokeWithTakeout && (q).query instanceof Api.account.FinishTakeoutSession)
    expect(finished).toBeTruthy()
    expect((finished).query.success).toBe(true)
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

        if (query instanceof Api.InvokeWithTakeout) {
          const inner = (query).query
          if (inner instanceof Api.messages.GetHistory) {
            historyCalls.push(inner)

            // Return one message for the first backward page, then end.
            if ((inner).offsetId === 0) {
              return { messages: [{ id: 3894497 }] }
            }
            return { messages: [] }
          }

          if (inner instanceof Api.account.FinishTakeoutSession) {
            return {}
          }
        }

        throw new Error('unexpected query')
      }),
    }

    const { ctx } = createMockCtx(client)

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
})
