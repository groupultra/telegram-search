import type { CoreContext } from '../context'
import type { MessageService } from '../services'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram/tl'

import { MESSAGE_PROCESS_BATCH_SIZE } from '../constants'

export function registerMessageEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:message:event')

  return (messageService: MessageService) => {
    emitter.on('message:fetch', async (opts) => {
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

          emitter.emit('message:process', { messages })
          messages = []
        }
      }

      if (messages.length > 0) {
        emitter.emit('message:process', { messages })
      }
    })

    emitter.on('message:fetch:specific', async ({ chatId, messageIds }) => {
      logger.withFields({ chatId, count: messageIds.length }).verbose('Fetching specific messages for media')

      try {
        // Fetch specific messages by their IDs from Telegram
        const messages = await messageService.fetchSpecificMessages(chatId, messageIds)

        if (messages.length > 0) {
          logger.withFields({ chatId, count: messages.length }).verbose('Fetched specific messages, processing for media')
          emitter.emit('message:process', { messages })
        }
      }
      catch (error) {
        logger.withError(error as Error).warn('Failed to fetch specific messages')
      }
    })

    emitter.on('message:send', async ({ chatId, content }) => {
      logger.withFields({ chatId, content }).verbose('Sending message')
      const updatedMessage = (await messageService.sendMessage(chatId, content)).unwrap() as Api.Updates

      logger.withFields({ message: updatedMessage }).verbose('Message sent')

      updatedMessage.updates.forEach((update) => {
        if (update instanceof Api.UpdateNewMessage) {
          if (update.message instanceof Api.Message) {
            emitter.emit('message:process', { messages: [update.message] })
          }
        }
      })
    })

    emitter.on('message:reprocess', async ({ chatId, messageIds, resolvers }) => {
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
        emitter.emit('message:process', { messages, forceRefetch: true })
      }
      catch (error) {
        logger.withError(error as Error).warn('Failed to re-process messages')
        ctx.withError(error as Error, 'Failed to re-process messages')
      }
    })
  }
}
