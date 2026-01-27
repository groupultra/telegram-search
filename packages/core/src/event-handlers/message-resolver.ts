import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { MessageResolverService } from '../services/message-resolver'

import { newQueue } from '@henrygd/queue'

import { MESSAGE_RESOLVER_QUEUE_SIZE } from '../constants'
import { CoreEventType } from '../types/events'

export function registerMessageResolverEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:message-resolver:event')

  return (messageResolverService: MessageResolverService) => {
    const queue = newQueue(MESSAGE_RESOLVER_QUEUE_SIZE)

    // TODO: debounce, background tasks
    ctx.emitter.on(CoreEventType.MessageProcess, ({ messages, isTakeout = false, syncOptions = {}, forceRefetch = false, batchId }) => {
      logger.withFields({ count: messages.length, isTakeout, syncOptions, forceRefetch, batchId }).verbose('Processing messages')

      if (!isTakeout) {
        messageResolverService.processMessages(messages, { takeout: false, syncOptions, forceRefetch, batchId }).catch((error) => {
          logger.withError(error).warn('Failed to process realtime messages')
        })

        return
      }

      // Only use queue for takeout mode to avoid overwhelming the system.
      void queue.add(async () => {
        messageResolverService.processMessages(messages, { takeout: true, syncOptions, forceRefetch, batchId }).catch((error) => {
          logger.withError(error).warn('Failed to process takeout messages')
        })
      })
    })
  }
}
