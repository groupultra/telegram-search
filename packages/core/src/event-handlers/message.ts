import type { CoreContext } from '../context'
import type { MessageService } from '../services'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram/tl'

import { MEDIA_PROCESS_BATCH_SIZE, MESSAGE_PROCESS_BATCH_SIZE } from '../constants'

/**
 * 检查消息是否包含媒体
 */
function hasMedia(message: Api.Message): boolean {
  return !!(message.media && (
    message.media instanceof Api.MessageMediaPhoto
    || message.media instanceof Api.MessageMediaDocument
  ))
}

/**
 * 根据消息内容动态决定批次大小
 * 包含大量媒体的消息使用更小的批次，以避免内存占用过高
 */
function getDynamicBatchSize(messages: Api.Message[]): number {
  const mediaCount = messages.filter(hasMedia).length
  const mediaRatio = messages.length > 0 ? mediaCount / messages.length : 0

  // 如果超过 50% 的消息包含媒体，使用较小的批次
  return mediaRatio > 0.5 ? MEDIA_PROCESS_BATCH_SIZE : MESSAGE_PROCESS_BATCH_SIZE
}

export function registerMessageEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:message:event')

  return (messageService: MessageService) => {
    emitter.on('message:fetch', async (opts) => {
      logger.withFields({ chatId: opts.chatId, minId: opts.minId, maxId: opts.maxId }).verbose('Fetching messages')

      let messages: Api.Message[] = []
      for await (const message of messageService.fetchMessages(opts.chatId, opts)) {
        messages.push(message)

        const batchSize = getDynamicBatchSize(messages)
        if (messages.length >= batchSize) {
          const mediaCount = messages.filter(hasMedia).length
          logger.withFields({
            total: messages.length,
            withMedia: mediaCount,
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
