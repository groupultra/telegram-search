import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { TakeoutService } from '../services'

import { defineInvokeHandler } from '@moeru/eventa'

import { safeOn } from '../context'
import { TakeoutRun, TakeoutStatsFetchInvoke, TakeoutTaskAbort } from '../types/events'

export function registerTakeoutEventHandlers(ctx: CoreContext, logger: Logger, takeoutService: TakeoutService) {
  logger = logger.withContext('core:takeout:event')

  safeOn(ctx.eventContext, TakeoutRun, async (params) => {
    await takeoutService.runTakeout(params)
  }, logger)

  safeOn(ctx.eventContext, TakeoutTaskAbort, ({ taskId }) => {
    takeoutService.abortTask(taskId)
  }, logger)

  defineInvokeHandler(ctx.eventContext, TakeoutStatsFetchInvoke, async ({ chatId }) => {
    return takeoutService.fetchChatSyncStats(chatId)
  })
}
