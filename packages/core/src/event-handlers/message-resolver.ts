import type { CoreContext } from '../context'
import type { MessageResolverService } from '../services/message-resolver'

import pLimit from 'p-limit'

import { MESSAGE_PROCESS_LIMIT } from '../constants'

export function registerMessageResolverEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx

  return (messageResolverService: MessageResolverService) => {
    const limit = pLimit(MESSAGE_PROCESS_LIMIT)

    // TODO: debounce, background tasks
    emitter.on('message:process', ({ messages }) => {
      limit(() => messageResolverService.processMessages(messages))
    })
  }
}
