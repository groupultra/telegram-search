import type { CoreContext } from '../context'
import type { MessageResolverService } from '../services/message-resolver'

export function registerMessageResolverEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx

  return (messageResolverService: MessageResolverService) => {
    // TODO: debounce, background tasks
    emitter.on('message:process', ({ messages }) => {
      messageResolverService.processMessages(messages)
    })
  }
}
