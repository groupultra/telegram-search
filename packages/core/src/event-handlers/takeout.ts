import type { CoreContext } from '../context'
import type { TakeoutService } from '../services'

import { defineInvokeHandler } from '@moeru/eventa'

import { takeoutRunEvent, takeoutStatsFetchInvoke, takeoutTaskAbortEvent } from '../events'
import { onEvent } from '../utils/promise'

export function registerTakeoutEventHandlers(ctx: CoreContext, takeoutService: TakeoutService) {
  onEvent(ctx.ctx, takeoutRunEvent, async (params) => {
    await takeoutService.runTakeout(params)
  })

  onEvent(ctx.ctx, takeoutTaskAbortEvent, ({ taskId }) => {
    takeoutService.abortTask(taskId)
  })

  defineInvokeHandler(ctx.ctx, takeoutStatsFetchInvoke, async ({ chatId }) => {
    return await takeoutService.fetchChatSyncStats(chatId)
  })
}
