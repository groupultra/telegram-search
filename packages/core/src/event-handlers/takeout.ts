import type { CoreContext } from '../context'
import type { TakeoutService } from '../services'

import { CoreEventType } from '../types/events'

export function registerTakeoutEventHandlers(ctx: CoreContext, takeoutService: TakeoutService) {
  ctx.emitter.on(CoreEventType.TakeoutRun, async (params) => {
    await takeoutService.runTakeout(params)
  })

  ctx.emitter.on(CoreEventType.TakeoutTaskAbort, ({ taskId }) => {
    takeoutService.abortTask(taskId)
  })

  ctx.emitter.on(CoreEventType.TakeoutStatsFetch, async ({ chatId }) => {
    await takeoutService.fetchChatSyncStats(chatId)
  })
}
