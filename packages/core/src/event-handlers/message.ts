import type { CoreContext } from '../context'
import type { MessageService } from '../services'

import { useLogger } from '@tg-search/logg'
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
