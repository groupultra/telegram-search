import type { CoreContext } from '../context'
import type { GramEventsService } from '../services/gram-events'

import { useLogger } from '@guiiai/logg'

export function registerGramEventsEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:gram:event')

  return (_: GramEventsService) => {
    emitter.on('gram:message:received', async ({ message }) => {
      logger.withFields({ message: message.id }).debug('Message received')

      emitter.emit('message:process', {
        messages: [
          message,
        ],
      })
    })
  }
}
