import type { CoreContext } from '../context'
import type { TakeoutService } from '../services'

import { TakeoutRun, TakeoutStatsFetch, TakeoutTaskAbort } from '../types/events'

export function registerTakeoutEventHandlers(ctx: CoreContext, takeoutService: TakeoutService) {
  ctx.emitter.on(TakeoutRun, async (params) => {
    await takeoutService.runTakeout(params)
  })

  ctx.emitter.on(TakeoutTaskAbort, ({ taskId }) => {
    takeoutService.abortTask(taskId)
  })

  ctx.emitter.on(TakeoutStatsFetch, async ({ chatId }) => {
    await takeoutService.fetchChatSyncStats(chatId)
  })
}
