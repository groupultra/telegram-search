import type { CoreContext } from '../context'
import type { createTakeoutService } from '../services'

import { useLogger } from '@tg-search/common'

export function registerTakeoutEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:takeout:event')

  return (takeoutService: ReturnType<typeof createTakeoutService>) => {
    emitter.on('takeout:run', async ({ chatIds }) => {
      logger.withFields({ chatIds }).debug('Running takeout')

      for (const chatId of chatIds) {
        for await (const message of takeoutService.takeoutMessages(chatId, { limit: 100 })) {
          emitter.emit('message:process', { message })
        }
      }
    })
  }
}
