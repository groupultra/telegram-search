import type { Models } from '../../models'

import { useLogger } from '@guiiai/logg'
import { defineInvoke } from '@moeru/eventa'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../../mock'
import { createCoreContext } from '../../context'
import { takeoutRunEvent, takeoutStatsFetchInvoke, takeoutTaskAbortEvent } from '../../events'
import { registerTakeoutEventHandlers } from '../takeout'

const logger = useLogger()

const models = {} as unknown as Models

describe('takeout event handlers', () => {
  it('takeout:run should delegate to takeoutService.runTakeout', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)
    const runTakeout = vi.fn()
    const takeoutService = { runTakeout } as any

    registerTakeoutEventHandlers(ctx, takeoutService)

    const params = { chatIds: ['123'], increase: false, syncOptions: {} }
    ctx.ctx.emit(takeoutRunEvent, params)

    expect(runTakeout).toHaveBeenCalledWith(params)
  })

  it('takeout:task:abort should delegate to takeoutService.abortTask', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)
    const abortTask = vi.fn()
    const takeoutService = { abortTask } as any

    registerTakeoutEventHandlers(ctx, takeoutService)

    ctx.ctx.emit(takeoutTaskAbortEvent, { taskId: 'task-1' })

    expect(abortTask).toHaveBeenCalledWith('task-1')
  })

  it('takeout:stats:fetch should delegate to takeoutService.fetchChatSyncStats', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)
    const fetchChatSyncStats = vi.fn(async () => ({ stats: [] }))
    const takeoutService = { fetchChatSyncStats } as any

    registerTakeoutEventHandlers(ctx, takeoutService)

    const invoke = defineInvoke(ctx.ctx, takeoutStatsFetchInvoke)
    await invoke({ chatId: '123' })

    expect(fetchChatSyncStats).toHaveBeenCalledWith('123')
  })
})
