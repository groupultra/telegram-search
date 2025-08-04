import type { CoreContext } from '../context'
import type { GramEventsService } from '../services/gram-events'

import { useLogger } from '@unbird/logg'

export function registerGramEventsEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:gram:event')

  return (_: GramEventsService) => {
    emitter.on('gram:message:received', async ({ message }) => {
      logger.verbose('Message received')

      emitter.emit('message:process', {
        messages: [
          message,
        ],
      })
    })
  }
}
