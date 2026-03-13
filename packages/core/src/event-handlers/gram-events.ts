import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { AccountModels } from '../models/accounts'
import type { ChatMessageModels } from '../models/chat-message'
import type { ChatModels } from '../models/chats'
import type { GramEventsService } from '../services/gram-events'

import { Api } from 'telegram'

import { CoreEventType } from '../types/events'

export function registerGramEventsEventHandlers(
  ctx: CoreContext,
  logger: Logger,
  accountModels: AccountModels,
  chatModels: ChatModels,
  chatMessageModels: ChatMessageModels,
) {
  logger = logger.withContext('core:gram:event')

  function getChatIdFromMessage(message: Api.Message): string {
    if (message.peerId instanceof Api.PeerChannel) {
      return String(message.peerId.channelId.toJSNumber())
    }

    if (message.peerId instanceof Api.PeerUser) {
      return String(message.peerId.userId.toJSNumber())
    }

    if (message.peerId instanceof Api.PeerChat) {
      return String(message.peerId.chatId.toJSNumber())
    }

    return ''
  }

  async function processRealtimeMessage(message: Api.Message, pts: number | undefined, date: number | undefined, isChannel: boolean) {
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

    logger.withFields({ message: message.id, fromId: message.fromId, content: message.message, pts, isChannel }).debug('Message received')

    ctx.emitter.emit(CoreEventType.MessageProcess, { messages: [message], syncOptions })

    if (!pts)
      return

    const accountId = ctx.getCurrentAccountId()
    if (isChannel) {
      let chatId = ''
      if (message.peerId instanceof Api.PeerChannel) {
        chatId = String(message.peerId.channelId.toJSNumber())
      }

      if (chatId) {
        await chatModels.updateChatPts(ctx.getDB(), accountId, chatId, pts)
      }
    }
    else {
      await accountModels.updateAccountState(ctx.getDB(), accountId, {
        pts,
        date,
      })
    }
  }

  return (_: GramEventsService) => {
    ctx.emitter.on(CoreEventType.GramMessageReceived, async ({ message, pts, date, isChannel }) => {
      await processRealtimeMessage(message, pts, date, isChannel)
    })

    ctx.emitter.on(CoreEventType.GramMessageEdited, async ({ message, pts, date, isChannel }) => {
      const chatId = getChatIdFromMessage(message)
      if (chatId) {
        ctx.emitter.emit(CoreEventType.MessageUpdated, {
          chatId,
          messageId: message.id.toString(),
        })
      }

      await processRealtimeMessage(message, pts, date, isChannel)
    })

    ctx.emitter.on(CoreEventType.GramMessageDeleted, async ({ messageIds, chatId, isChannel, pts }) => {
      const accountId = ctx.getCurrentAccountId()
      if (messageIds.length === 0)
        return

      const deletedCount = await chatMessageModels.softDeleteMessages(ctx.getDB(), accountId, messageIds, chatId ? { chatId } : undefined)

      if (isChannel && chatId && pts !== undefined) {
        await chatModels.updateChatPts(ctx.getDB(), accountId, chatId, pts)
      }
      else if (!isChannel && pts !== undefined) {
        await accountModels.updateAccountState(ctx.getDB(), accountId, {
          pts,
        })
      }

      ctx.emitter.emit(CoreEventType.MessageDeleted, {
        chatId,
        messageIds,
      })

      logger.withFields({ messageIds, chatId, isChannel, deletedCount }).verbose('Messages soft-deleted')
    })
  }
}
