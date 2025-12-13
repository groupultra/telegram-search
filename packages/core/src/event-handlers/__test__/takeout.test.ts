import type { CoreTaskData, CoreTaskType } from '../../types/task'

import { describe, expect, it, vi } from 'vitest'

import { createCoreContext } from '../../context'
import { registerTakeoutEventHandlers } from '../takeout'

const mockGetChatMessageStatsByChatId = vi.fn()

vi.mock('../../models', () => {
  return {
    getChatMessageStatsByChatId: (...args: any[]) => mockGetChatMessageStatsByChatId(...args),
  }
})

interface MockTask {
  state: CoreTaskData<CoreTaskType>
  abort: ReturnType<typeof vi.fn>
  updateProgress: ReturnType<typeof vi.fn>
  updateError: ReturnType<typeof vi.fn>
}

let taskSeq = 0
const mockCreateTask = vi.fn((_name: string, _payload: unknown, _emitter: unknown): MockTask => {
  const abortController = new AbortController()
  const task: MockTask = {
    state: {
      taskId: `task-${++taskSeq}`,
      type: 'takeout',
      progress: 0,
      metadata: { chatIds: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      abortController,
    },
    abort: vi.fn(() => abortController.abort()),
    updateProgress: vi.fn(),
    updateError: vi.fn(),
  }
  return task
})

vi.mock('../../utils/task', () => {
  return {
    createTask: (...args: [string, unknown, unknown]) => mockCreateTask(args[0], args[1], args[2]),
  }
})

function makeTakeoutService(overrides?: Partial<{ takeoutMessages: any, getTotalMessageCount: any }>) {
  return {
    takeoutMessages: overrides?.takeoutMessages ?? async function* () { /* empty */ },
    getTotalMessageCount: overrides?.getTotalMessageCount ?? (async () => 0),
  }
}

function tick() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

describe('takeout event handlers', () => {
  it('takeout:run (full sync) should emit message:process in batches and flush remaining', async () => {
    taskSeq = 0
    mockCreateTask.mockClear()
    mockGetChatMessageStatsByChatId.mockReset()

    // Stats are still queried even in full sync.
    mockGetChatMessageStatsByChatId.mockResolvedValue({
      unwrap: () => undefined,
    })

    const ctx = createCoreContext()
    ctx.setCurrentAccountId('acc-1')

    const takeoutMessages = async function* () {
      for (let i = 1; i <= 51; i++) {
        yield ({ id: i })
      }
    }

    registerTakeoutEventHandlers(ctx)(makeTakeoutService({ takeoutMessages }))

    const batches: Array<{ messages: any[], isTakeout: boolean, syncOptions: any }> = []
    const done = new Promise<void>((resolve) => {
      ctx.emitter.on('message:process', (payload) => {
        batches.push(payload as any)
        const total = batches.reduce((sum, b) => sum + b.messages.length, 0)
        if (batches.length === 2 && total === 51) {
          resolve()
        }
      })
    })

    const syncOptions = { syncMedia: true }

    ctx.emitter.emit('takeout:run', {
      chatIds: ['123'],
      increase: false,
      syncOptions,
    })

    await done

    expect(mockCreateTask).toHaveBeenCalledTimes(1)

    expect(batches).toHaveLength(2)
    expect(batches[0].messages).toHaveLength(50)
    expect(batches[1].messages).toHaveLength(1)

    expect(batches[0].isTakeout).toBe(true)
    expect(batches[1].isTakeout).toBe(true)

    expect(batches[0].syncOptions).toEqual(syncOptions)
    expect(batches[1].syncOptions).toEqual(syncOptions)
  })

  it('takeout:task:abort should abort an active takeout task', async () => {
    taskSeq = 0
    mockCreateTask.mockClear()
    mockGetChatMessageStatsByChatId.mockReset()

    mockGetChatMessageStatsByChatId.mockResolvedValue({ unwrap: () => undefined })

    const ctx = createCoreContext()
    ctx.setCurrentAccountId('acc-1')

    const takeoutMessages = async function* (_chatId: string, opts: any) {
      // Keep yielding until aborted; yield slowly to allow abort event to be processed.
      let i = 0
      while (!opts.task.abortController.signal.aborted && i < 10_000) {
        i++
        await tick()
        yield ({ id: i })
      }
    }

    registerTakeoutEventHandlers(ctx)(makeTakeoutService({ takeoutMessages }))

    ctx.emitter.emit('takeout:run', {
      chatIds: ['123'],
      increase: false,
      syncOptions: { syncMedia: false },
    })

    // Let the handler create and register the task.
    await tick()

    expect(mockCreateTask).toHaveBeenCalledTimes(1)
    const task = mockCreateTask.mock.results[0]!.value as MockTask

    ctx.emitter.emit('takeout:task:abort', { taskId: task.state.taskId })

    expect(task.abort).toHaveBeenCalledTimes(1)
    expect(task.state.abortController.signal.aborted).toBe(true)
  })

  it('takeout:stats:fetch should emit takeout:stats:data with mapped fields', async () => {
    taskSeq = 0
    mockCreateTask.mockClear()
    mockGetChatMessageStatsByChatId.mockReset()

    mockGetChatMessageStatsByChatId.mockResolvedValue({
      unwrap: () => ({
        message_count: 12,
        first_message_id: 10,
        latest_message_id: 99,
        first_message_at: 1000,
        latest_message_at: 2000,
      }),
    })

    const ctx = createCoreContext()
    ctx.setCurrentAccountId('acc-1')

    registerTakeoutEventHandlers(ctx)(
      makeTakeoutService({
        getTotalMessageCount: async () => 120,
      }),
    )

    const dataPromise = new Promise<any>((resolve) => {
      ctx.emitter.on('takeout:stats:data', payload => resolve(payload))
    })

    ctx.emitter.emit('takeout:stats:fetch', { chatId: '123' })

    const stats = await dataPromise

    expect(stats).toEqual({
      chatId: '123',
      totalMessages: 120,
      syncedMessages: 12,
      firstMessageId: 10,
      latestMessageId: 99,
      oldestMessageDate: new Date(1000 * 1000),
      newestMessageDate: new Date(2000 * 1000),
      syncedRanges: [{ start: 10, end: 99 }],
    })
  })

  it('takeout:stats:fetch should emit core:error when stats fetch throws', async () => {
    taskSeq = 0
    mockCreateTask.mockClear()
    mockGetChatMessageStatsByChatId.mockReset()

    mockGetChatMessageStatsByChatId.mockImplementation(() => {
      throw new Error('boom')
    })

    const ctx = createCoreContext()
    ctx.setCurrentAccountId('acc-1')

    registerTakeoutEventHandlers(ctx)(
      makeTakeoutService({
        getTotalMessageCount: async () => 0,
      }),
    )

    const errorPromise = new Promise<{ error: string, description?: string }>((resolve) => {
      ctx.emitter.on('core:error', payload => resolve(payload))
    })

    ctx.emitter.emit('takeout:stats:fetch', { chatId: '123' })

    const err = await errorPromise
    expect(err.error).toBe('boom')
  })

  it('takeout:run (incremental) should call takeoutMessages in backward+forward phases and flush messages', async () => {
    taskSeq = 0
    mockCreateTask.mockClear()
    mockGetChatMessageStatsByChatId.mockReset()

    const statsRow = {
      message_count: 3,
      first_message_id: 10,
      latest_message_id: 100,
    }

    mockGetChatMessageStatsByChatId.mockResolvedValue({
      unwrap: () => statsRow,
    })

    const ctx = createCoreContext()
    ctx.setCurrentAccountId('acc-1')

    const calls: any[] = []
    const takeoutMessages = async function* (_chatId: string, opts: any) {
      calls.push(opts)

      // Phase 1: backward (offset=0)
      if (opts.pagination?.offset === 0) {
        // Include latestMessageId itself to verify handler skips it.
        yield ({ id: 100 })
        yield ({ id: 101 })
        return
      }

      // Phase 2: forward (offset=first_message_id)
      if (opts.pagination?.offset === 10) {
        yield ({ id: 9 })
        yield ({ id: 8 })
      }
    }

    const service = makeTakeoutService({
      getTotalMessageCount: async () => 10,
      takeoutMessages,
    })

    registerTakeoutEventHandlers(ctx)(service)

    const processed = new Promise<any>((resolve) => {
      ctx.emitter.on('message:process', payload => resolve(payload))
    })

    ctx.emitter.emit('takeout:run', {
      chatIds: ['123'],
      increase: true,
      syncOptions: undefined,
    })

    const payload = await processed

    expect(mockCreateTask).toHaveBeenCalledTimes(1)
    const task = mockCreateTask.mock.results[0]!.value as MockTask
    expect(task.updateProgress).toHaveBeenCalledWith(0, 'Starting incremental sync')
    expect(task.updateProgress).toHaveBeenCalledWith(100, 'Incremental sync completed')

    // Backward + forward phases
    expect(calls).toHaveLength(2)
    const backward = calls[0]
    const forward = calls[1]

    expect(backward.pagination.offset).toBe(0)
    expect(backward.minId).toBe(100)
    expect(backward.disableAutoProgress).toBe(true)

    expect(forward.pagination.offset).toBe(10)
    expect(forward.disableAutoProgress).toBe(true)

    // Ensure latestMessageId itself was skipped.
    expect(payload.messages.map((m: any) => m.id)).toEqual([101, 9, 8])
    expect(payload.isTakeout).toBe(true)
  })

  it('takeout:run (incremental) should fallback to full sync when no existing stats', async () => {
    taskSeq = 0
    mockCreateTask.mockClear()
    mockGetChatMessageStatsByChatId.mockReset()

    // No stats => first/latest = 0
    mockGetChatMessageStatsByChatId.mockResolvedValue({
      unwrap: () => undefined,
    })

    const ctx = createCoreContext()
    ctx.setCurrentAccountId('acc-1')

    const calls: any[] = []
    const takeoutMessages = async function* (_chatId: string, opts: any) {
      calls.push(opts)
      yield ({ id: 1 })
      yield ({ id: 2 })
    }

    registerTakeoutEventHandlers(ctx)(makeTakeoutService({ takeoutMessages }))

    const processed = new Promise<any>((resolve) => {
      ctx.emitter.on('message:process', payload => resolve(payload))
    })

    ctx.emitter.emit('takeout:run', {
      chatIds: ['123'],
      increase: true,
      syncOptions: { minMessageId: 0, maxMessageId: 0 },
    })

    const payload = await processed
    expect(calls).toHaveLength(1)
    expect(calls[0].pagination.offset).toBe(0)
    expect(payload.messages.map((m: any) => m.id)).toEqual([1, 2])
  })
})
