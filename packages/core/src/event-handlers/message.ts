import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { MessageService } from '../services'

import { Api } from 'telegram/tl'
import { v4 as uuidv4 } from 'uuid'

import { MESSAGE_PROCESS_BATCH_SIZE } from '../constants'
import { convertToCoreMessage } from '../utils/message'

export function registerMessageEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:message:event')

  return (messageService: MessageService) => {
    ctx.emitter.on('message:fetch', async (opts) => {
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

          ctx.emitter.emit('message:process', { messages })
          messages = []
        }
      }

      if (messages.length > 0) {
        ctx.emitter.emit('message:process', { messages })
      }
    })

    ctx.emitter.on('message:fetch:specific', async ({ chatId, messageIds }) => {
      logger.withFields({ chatId, count: messageIds.length }).verbose('Fetching specific messages for media')

      try {
        // Fetch specific messages by their IDs from Telegram
        const messages = await messageService.fetchSpecificMessages(chatId, messageIds)

        if (messages.length > 0) {
          logger.withFields({ chatId, count: messages.length }).verbose('Fetched specific messages, processing for media')
          ctx.emitter.emit('message:process', { messages })
        }
      }
      catch (error) {
        logger.withError(error as Error).warn('Failed to fetch specific messages')
      }
    })

    ctx.emitter.on('message:send', async ({ chatId, content }) => {
      logger.withFields({ chatId, content }).verbose('Sending message')
      const updatedMessage = (await messageService.sendMessage(chatId, content)).unwrap()

      switch (updatedMessage.className) {
        case 'Updates':
          updatedMessage.updates.forEach((update) => {
            if ('message' in update && update.message instanceof Api.Message) {
              ctx.emitter.emit('message:process', { messages: [update.message] })
            }
          })
          break
        case 'UpdateShortSentMessage': {
          const sender = ctx.getMyUser()
          ctx.emitter.emit('message:data', {
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

    ctx.emitter.on('message:reprocess', async ({ chatId, messageIds, resolvers }) => {
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
        ctx.emitter.emit('message:process', { messages, forceRefetch: true })
      }
      catch (error) {
        logger.withError(error as Error).warn('Failed to re-process messages')
        ctx.withError(error as Error, 'Failed to re-process messages')
      }
    })

    ctx.emitter.on('message:fetch:unread', async ({ chatId, limit, startTime }) => {
      logger.withFields({ chatId, limit, startTime }).verbose('Fetching unread messages')
      try {
        const messages = await messageService.fetchUnreadMessages(chatId, { limit, startTime })
        // Reverse to have chronological order (oldest first) which is better for LLM summary
        // getMessages usually returns newest first.
        messages.reverse()

        const coreMessages = messages.map(convertToCoreMessage).map(result => result.unwrap())
        ctx.emitter.emit('message:unread-data', { messages: coreMessages })
      }
      catch (e) {
        ctx.withError(e, 'Failed to fetch unread messages')
      }
    })

    ctx.emitter.on('message:read', async ({ chatId }) => {
      logger.withFields({ chatId }).verbose('Marking messages as read')
      await messageService.markAsRead(chatId)
    })
  }
}
