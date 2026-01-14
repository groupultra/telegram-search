import type { CoreContext } from '../context'
import type { TakeoutService } from '../services'

export function registerTakeoutEventHandlers(ctx: CoreContext, takeoutService: TakeoutService) {
  ctx.emitter.on('takeout:run', async (params) => {
    await takeoutService.runTakeout(params)
  })

  ctx.emitter.on('takeout:task:abort', ({ taskId }) => {
    takeoutService.abortTask(taskId)
  })

  ctx.emitter.on('takeout:stats:fetch', async ({ chatId }) => {
    await takeoutService.fetchChatSyncStats(chatId)
  })
}
