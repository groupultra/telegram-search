import type { CoreContext } from '../context'
import type { createMessageService } from '../services'

import { useLogger } from '@tg-search/common'

export function registerMessageEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:message:event')

  return (messageService: ReturnType<typeof createMessageService>) => {
    emitter.on('message:process', ({ message }) => {
      messageService.processMessage(message)
    })

    // emitter.on('message:record', ({ message }) => {
    // })

    emitter.on('message:fetch', async ({ chatId }) => {
      logger.withFields({ chatId }).debug('Fetching messages')

      try {
        await messageService.fetchMessages(chatId, { limit: 100 }).next()
      }
      catch (error) {
        emitter.emit('core:error', { error })
      }
    })
  }
}
