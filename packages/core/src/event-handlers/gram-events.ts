import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { AccountModels } from '../models/accounts'
import type { ChatModels } from '../models/chats'
import type { GramEventsService } from '../services/gram-events'

import { Api } from 'telegram'

import { CoreEventType } from '../types/events'

export function registerGramEventsEventHandlers(ctx: CoreContext, logger: Logger, accountModels: AccountModels, chatModels: ChatModels) {
  logger = logger.withContext('core:gram:event')

  return (_: GramEventsService) => {
    ctx.emitter.on(CoreEventType.GramMessageReceived, async ({ message, pts, date, isChannel }) => {
      const accountSettings = await ctx.getAccountSettings()
      const receiveSettings = accountSettings.messageProcessing?.receiveMessages

      if (!receiveSettings?.receiveAll) {
        return
      }

      const defaults = accountSettings.messageProcessing?.defaults
      const downloadMedia = receiveSettings.downloadMedia ?? true
      const syncOptions = {
        ...defaults,
        syncMedia: downloadMedia,
      }

      logger.withFields({ message: message.id, fromId: message.fromId, content: message.text, pts, isChannel }).debug('Message received')

      ctx.emitter.emit(CoreEventType.MessageProcess, { messages: [message], syncOptions })

      if (!pts)
        return

      const accountId = ctx.getCurrentAccountId()
      if (isChannel) {
        // For channels/supergroups, update the chat-specific PTS in account_joined_chats
        let chatId = ''
        if (message.peerId instanceof Api.PeerChannel) {
          chatId = String(message.peerId.channelId.toJSNumber())
        }

        if (chatId) {
          await chatModels.updateChatPts(ctx.getDB(), accountId, chatId, pts)
        }
      }
      else {
        // For private dialogs/basic groups, update the global account PTS
        await accountModels.updateAccountState(ctx.getDB(), accountId, {
          pts,
          date,
        })
      }
    })
  }
}
