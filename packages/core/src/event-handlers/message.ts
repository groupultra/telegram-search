import type { CoreContext } from '../context'
import type { MessageService } from '../services'

import { useLogger } from '@unbird/logg'
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

        if (messages.length >= MESSAGE_PROCESS_BATCH_SIZE) {
          emitter.emit('message:process', { messages })
          messages = []
        }
      }

      if (messages.length > 0) {
        emitter.emit('message:process', { messages })
      }
    })

    emitter.on('message:fetch:specific', async ({ chatId, messageIds }) => {
      logger.withFields({ chatId, messageIds: messageIds.length }).verbose('Fetching specific messages for media')

      try {
        // Fetch specific messages by their IDs from Telegram
        const messages = await messageService.fetchSpecificMessages(chatId, messageIds)

        if (messages.length > 0) {
          logger.withFields({ count: messages.length }).verbose('Fetched specific messages, processing for media')
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
  }
}
