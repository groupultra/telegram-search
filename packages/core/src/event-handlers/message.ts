import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { MessageService } from '../services'
import type { CoreMessage } from '../types/message'

import { defineInvokeHandler } from '@moeru/eventa'
import { Api } from 'telegram/tl'
import { v4 as uuidv4 } from 'uuid'

import { MESSAGE_PROCESS_BATCH_SIZE } from '../constants'
import { messageDataEvent, messageFetchEvent, messageFetchSpecificEvent, messageFetchSummaryInvoke, messageFetchUnreadInvoke, messageProcessEvent, messageReadEvent, messageReprocessEvent, messageSendEvent } from '../events'
import { convertToCoreMessage } from '../utils/message'

export function registerMessageEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:message:event')

  return (messageService: MessageService) => {
    function toCoreMessages(messages: Api.Message[]): CoreMessage[] {
      return messages
        .map(convertToCoreMessage)
        .map(result => result.unwrap())
    }

    ctx.ctx.on(messageFetchEvent, async ({ body: opts }) => {
      logger.withFields({ chatId: opts.chatId, minId: opts.minId, maxId: opts.maxId }).verbose('Fetching messages')

      let messages: Api.Message[] = []
      for await (const message of messageService.fetchMessages(opts.chatId, opts)) {
        messages.push(message)

        const batchSize = MESSAGE_PROCESS_BATCH_SIZE
        if (messages.length >= batchSize) {
          logger.withFields({
            total: messages.length,
            batchSize,
          }).debug('Processing message batch')

          ctx.ctx.emit(messageProcessEvent, { messages })
          messages = []
        }
      }

      if (messages.length > 0) {
        ctx.ctx.emit(messageProcessEvent, { messages })
      }
    })

    ctx.ctx.on(messageFetchSpecificEvent, async ({ body: { chatId, messageIds } }) => {
      logger.withFields({ chatId, count: messageIds.length }).verbose('Fetching specific messages for media')

      try {
        // Fetch specific messages by their IDs from Telegram
        const messages = await messageService.fetchSpecificMessages(chatId, messageIds)

        if (messages.length > 0) {
          logger.withFields({ chatId, count: messages.length }).verbose('Fetched specific messages, processing for media')
          ctx.ctx.emit(messageProcessEvent, { messages })
        }
      }
      catch (error) {
        logger.withError(error as Error).warn('Failed to fetch specific messages')
      }
    })

    ctx.ctx.on(messageSendEvent, async ({ body: { chatId, content } }) => {
      logger.withFields({ chatId, content }).verbose('Sending message')
      const updatedMessage = (await messageService.sendMessage(chatId, content)).unwrap()

      switch (updatedMessage.className) {
        case 'Updates':
          updatedMessage.updates.forEach((update) => {
            if ('message' in update && update.message instanceof Api.Message) {
              ctx.ctx.emit(messageProcessEvent, { messages: [update.message] })
            }
          })
          break
        case 'UpdateShortSentMessage': {
          const sender = ctx.getMyUser()
          ctx.ctx.emit(messageDataEvent, {
            messages: [{
              uuid: uuidv4(),
              platform: 'telegram',
              platformMessageId: updatedMessage.id.toString(),
              chatId,
              fromId: sender.id,
              fromName: sender.name,
              content,
              reply: { isReply: false, replyToId: undefined, replyToName: undefined },
              forward: { isForward: false, forwardFromChatId: undefined, forwardFromChatName: undefined, forwardFromMessageId: undefined },
              platformTimestamp: updatedMessage.date,
            }],
          })
          break
        }
        default:
          logger.withFields({ message: updatedMessage }).warn('Unknown message type')
          break
      }

      logger.withFields({ content }).verbose('Message sent')
    })

    ctx.ctx.on(messageReprocessEvent, async ({ body: { chatId, messageIds, resolvers } }) => {
      // Validate input
      if (messageIds.length === 0) {
        logger.withFields({ chatId }).warn('Re-process called with empty messageIds array')
        return
      }

      logger.withFields({ chatId, messageIds, resolvers }).verbose('Re-processing messages')

      try {
        // Fetch specific messages by their IDs from Telegram
        const messages = await messageService.fetchSpecificMessages(chatId, messageIds)

        if (messages.length === 0) {
          logger.withFields({ chatId, messageIds }).warn('No messages found for re-processing')
          return
        }

        logger.withFields({ count: messages.length, resolvers }).verbose('Fetched messages for re-processing')

        // NOTE: The 'resolvers' parameter is currently not passed to message:process.
        // The message:process event runs all enabled resolvers (not disabled in account settings).
        // This is acceptable for the initial implementation since re-downloading media
        // will also update other resolver outputs (embeddings, tokens, etc.) if enabled.
        // Future enhancement: Add resolver filtering to message:process event to run only
        // specific resolvers and avoid unnecessary work.
        //
        // Force refetch to skip database cache and re-download from Telegram.
        // This is necessary when media files are missing from storage (404 errors).
        ctx.ctx.emit(messageProcessEvent, { messages, forceRefetch: true })
      }
      catch (error) {
        logger.withError(error as Error).warn('Failed to re-process messages')
        ctx.withError(error as Error, 'Failed to re-process messages')
      }
    })

    defineInvokeHandler(ctx.ctx, messageFetchUnreadInvoke, async ({ chatId, limit, startTime }) => {
      logger.withFields({ chatId, limit, startTime }).verbose('Fetching unread messages')
      const messages = await messageService.fetchUnreadMessages(chatId, { limit, startTime })
      // Reverse to have chronological order (oldest first) which is better for LLM summary
      // getMessages usually returns newest first.
      messages.reverse()

      return { messages: toCoreMessages(messages) }
    })

    defineInvokeHandler(ctx.ctx, messageFetchSummaryInvoke, async ({ chatId, limit, mode, requestId }) => {
      logger.withFields({ chatId, limit, mode, requestId }).verbose('Fetching summary messages')

      if (mode === 'unread') {
        const unread = await messageService.fetchUnreadMessages(chatId, { limit })
        unread.reverse()
        return {
          messages: toCoreMessages(unread),
          mode: 'unread' as const,
          requestId,
        }
      }

      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfTodayTs = Math.floor(startOfToday.getTime() / 1000)
      const startTime = mode === 'today'
        ? startOfTodayTs
        : Math.floor(Date.now() / 1000) - 24 * 60 * 60

      const recent = await messageService.fetchRecentMessagesByTimeRange(chatId, { startTime, limit })
      recent.reverse()

      return {
        messages: toCoreMessages(recent),
        mode,
        requestId,
      }
    })

    ctx.ctx.on(messageReadEvent, async ({ body: { chatId } }) => {
      logger.withFields({ chatId }).verbose('Marking messages as read')
      await messageService.markAsRead(chatId)
    })
  }
}
