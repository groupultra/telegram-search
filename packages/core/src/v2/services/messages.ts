import type { TelegramMessageType } from '../../types'
import type { CoreContext } from '../context'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'

import { withResult } from '../utils/result'
import { withRetry } from '../utils/retry'

export interface MessageEvent {
  'message:fetch': (data: { chatId: string }) => void

  'message:fetch:progress': (data: { taskId: string, progress: number }) => void

  'message:fetch:abort': (data: { taskId: string }) => void

  'message:process': (data: { message: Api.Message }) => void

  'message:record': (data: { message: Api.Message }) => void
}

export interface FetchMessageOpts {
  chatId: string
  limit?: number
  startTime?: Date
  endTime?: Date

  // Filter
  skipMedia?: boolean
  messageTypes?: TelegramMessageType[]

  // Incremental export
  minId?: number
  maxId?: number
}

export function createMessageService(ctx: CoreContext) {
  const logger = useLogger()

  const { emitter, getClient, withError } = ctx

  // TODO: worker_threads?
  function processMessage(message: Api.Message) {
    logger.withFields({ message }).debug('Process message')
    emitter.emit('message:record', { message })
  }

  // function toInternalMessage(message: Api.Message): TelegramMessage {
  //   return {
  //     id: message.id,
  //     chatId: message.chatId?.toString(),
  //     type: message.media ? 'media' : 'text',
  //     createdAt: new Date(message.date * 1000),
  //     text: message.message,
  //     media: message.media,
  //   }
  // }

  return {
    processMessage,

    async* fetchMessages(
      chatId: string,
      options: Omit<FetchMessageOpts, 'chatId'>,
    ): AsyncGenerator<Api.Message> {
      let offsetId = 0
      let hasMore = true
      let processedCount = 0

      const limit = options.limit || 100
      const minId = options?.minId || 0
      const maxId = options?.maxId || 0
      const startTime = options?.startTime || new Date()
      const endTime = options?.endTime || new Date()

      logger.withFields({ chatId, limit, minId, maxId, startTime, endTime }).debug('Fetch messages options')

      // await getClient().getDialogs()

      // const chat = dialogs.find(d => d.id?.toString() === chatId)
      // if (!chat) {
      //   throw new Error(`Chat not found: ${chatId}`)
      // }

      while (hasMore) {
        try {
          const entity = await getClient().getInputEntity(chatId)

          const messages = await withRetry(
            () => getClient().getMessages(entity, {
              limit,
              offsetId,
              minId,
              maxId,
            }),
          )

          if (messages.length === 0) {
            logger.error('Get messages failed or returned empty data')
            return withResult(null, new Error('Get messages failed or returned empty data'))
          }

          // If we got fewer messages than requested, there are no more
          hasMore = messages.length === limit

          for (const message of messages) {
            // Skip empty messages
            if (message instanceof Api.MessageEmpty) {
              continue
            }

            // Check time range
            const messageTime = new Date(message.date * 1000)
            if (startTime && messageTime < startTime) {
              continue
            }
            if (endTime && messageTime > endTime) {
              continue
            }

            processMessage(message)

            yield message
            processedCount++

            // Update offsetId to current message ID
            offsetId = message.id

            // Check if we've reached the limit
            if (limit && processedCount >= limit) {
              return
            }
          }
        }
        catch (error) {
          return withResult(null, withError(error, 'Fetch messages failed'))
        }
      }
    },
  }
}
