import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { registerChatHandlers } from './chats'
import { registerMessageHandlers } from './messages'

export function registerApplicationHandlers(context: EventContext<any, any>, application: TelegramApplication): () => void {
  const chatDisposers = registerChatHandlers(context, application)
  const messageDisposers = registerMessageHandlers(context, application)
  return () => {
    for (const dispose of [...Object.values(chatDisposers), ...Object.values(messageDisposers)]) {
      dispose()
    }
  }
}
