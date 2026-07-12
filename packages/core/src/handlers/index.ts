import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { registerAuthHandlers } from './auth'
import { registerChatHandlers } from './chats'
import { registerMessageHandlers } from './messages'
import { registerSyncHandler } from './sync'

export function registerApplicationHandlers(context: EventContext<any, any>, application: TelegramApplication): () => void {
  const chatDisposers = registerChatHandlers(context, application)
  const messageDisposers = registerMessageHandlers(context, application)
  const disposeAuth = registerAuthHandlers(context, application)
  registerSyncHandler(context, application)
  return () => {
    disposeAuth()
    for (const dispose of [...Object.values(chatDisposers), ...Object.values(messageDisposers)]) {
      dispose()
    }
  }
}
