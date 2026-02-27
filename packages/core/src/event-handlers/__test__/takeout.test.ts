import type { Models } from '../../models'

import { useLogger } from '@guiiai/logg'
import { defineInvoke } from '@moeru/eventa'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../../mock'
import { createCoreContext } from '../../context'
import { TakeoutRun, TakeoutStatsFetchInvoke, TakeoutTaskAbort } from '../../types/events'
import { registerTakeoutEventHandlers } from '../takeout'

const logger = useLogger()

const models = {} as unknown as Models

describe('takeout event handlers', () => {
  it('takeout:run should delegate to takeoutService.runTakeout', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)
    const runTakeout = vi.fn()
    const takeoutService = { runTakeout } as any

    registerTakeoutEventHandlers(ctx, logger, takeoutService)

    const params = { chatIds: ['123'], increase: false, syncOptions: {} }
    ctx.eventContext.emit(TakeoutRun, params)

    expect(runTakeout).toHaveBeenCalledWith(params)
  })

  it('takeout:task:abort should delegate to takeoutService.abortTask', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)
    const abortTask = vi.fn()
    const takeoutService = { abortTask } as any

    registerTakeoutEventHandlers(ctx, logger, takeoutService)

    ctx.eventContext.emit(TakeoutTaskAbort, { taskId: 'task-1' })

    expect(abortTask).toHaveBeenCalledWith('task-1')
  })

  it('takeout:stats:fetch should delegate to takeoutService.fetchChatSyncStats via invoke', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)
    const mockStats = { chatId: '123', totalMessages: 100, syncedMessages: 50, firstMessageId: 1, latestMessageId: 100, syncedRanges: [] }
    const fetchChatSyncStats = vi.fn(async (_chatId: string) => mockStats)
    const takeoutService = { fetchChatSyncStats } as any

    registerTakeoutEventHandlers(ctx, logger, takeoutService)

    // Use defineInvoke to call the invoke handler end-to-end
    const invoke = defineInvoke(ctx.eventContext, TakeoutStatsFetchInvoke)
    const result = await invoke({ chatId: '123' })

    expect(fetchChatSyncStats).toHaveBeenCalledWith('123')
    expect(result).toEqual(mockStats)
  })
})
