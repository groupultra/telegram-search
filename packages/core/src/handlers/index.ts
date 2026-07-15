import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { registerChatHandlers } from './chats'
import { registerExportHandler } from './export'
import { registerMessageHandlers } from './messages'
import { registerStatsHandler } from './stats'
import { registerSyncHandler } from './sync'

export function registerApplicationHandlers(context: EventContext<any, any>, application: TelegramApplication): () => void {
  const chatDisposers = registerChatHandlers(context, application)
  const messageDisposers = registerMessageHandlers(context, application)
  const disposeStats = registerStatsHandler(context, application)
  registerSyncHandler(context, application)
  registerExportHandler(context, application)
  return () => {
    disposeStats()
    for (const dispose of [...Object.values(chatDisposers), ...Object.values(messageDisposers)]) {
      dispose()
    }
  }
}
