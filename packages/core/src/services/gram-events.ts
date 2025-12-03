import type { CoreContext } from '../context'

import { useLogger } from '@guiiai/logg'
import { NewMessage } from 'telegram/events'

export type GramEventsService = ReturnType<typeof createGramEventsService>

export function createGramEventsService(ctx: CoreContext) {
  const { emitter, getClient } = ctx
  const logger = useLogger('core:gram-events')

  // Store event handler reference and event type for cleanup
  let eventHandler: ((event: any) => void) | undefined
  let eventType: NewMessage | undefined

  function registerGramEvents() {
    // Prevent duplicate registration
    if (eventHandler) {
      logger.debug('Telegram event handler already registered')
      return
    }

    eventHandler = (event) => {
      if (event.message) {
        emitter.emit('gram:message:received', { message: event.message })
      }
    }
    eventType = new NewMessage({})
    getClient().addEventHandler(eventHandler, eventType)
    logger.debug('Registered Telegram event handler')
  }

  function cleanup() {
    if (eventHandler && eventType) {
      try {
        const client = getClient()
        if (client) {
          client.removeEventHandler(eventHandler, eventType)
          logger.debug('Removed Telegram event handler')
        }
      }
      catch (error) {
        logger.withError(error).warn('Failed to remove Telegram event handler')
      }
      eventHandler = undefined
      eventType = undefined
    }
  }

  // Listen for cleanup event
  emitter.once('core:cleanup', cleanup)

  return {
    registerGramEvents,
    cleanup,
  }
}
