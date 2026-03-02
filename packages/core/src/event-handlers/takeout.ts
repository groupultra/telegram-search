import type { CoreContext } from '../context'
import type { TakeoutService } from '../services'

import { defineInvokeHandler } from '@moeru/eventa'

import { takeoutRunEvent, takeoutStatsFetchInvoke, takeoutTaskAbortEvent } from '../events'

export function registerTakeoutEventHandlers(ctx: CoreContext, takeoutService: TakeoutService) {
  ctx.ctx.on(takeoutRunEvent, async ({ body: params }) => {
    await takeoutService.runTakeout(params)
  })

  ctx.ctx.on(takeoutTaskAbortEvent, ({ body: { taskId } }) => {
    takeoutService.abortTask(taskId)
  })

  defineInvokeHandler(ctx.ctx, takeoutStatsFetchInvoke, async ({ chatId }) => {
    return await takeoutService.fetchChatSyncStats(chatId)
  })
}
