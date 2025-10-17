import type { CoreContext } from '../context'
import type { MessageResolverService } from '../services/message-resolver'

import { useLogger } from '@unbird/logg'
import pLimit from 'p-limit'

import { MESSAGE_PROCESS_LIMIT } from '../constants'

export function registerMessageResolverEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:message-resolver:event')

  return (messageResolverService: MessageResolverService) => {
    const limit = pLimit(MESSAGE_PROCESS_LIMIT)

    // TODO: debounce, background tasks
    emitter.on('message:process', ({ messages }) => {
      void limit(async () => {
        try {
          await messageResolverService.processMessages(messages)
        }
        catch (error) {
          logger.withError(error).warn('Failed to process messages')
        }
      })
    })
  }
}
