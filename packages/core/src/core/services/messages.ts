import type { TelegramClient } from 'telegram'
import type { TelegramMessageType } from '../../types'
import type { CoreEmitter } from '../client'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'

import { withResult } from '../utils/result'
import { withRetry } from '../utils/retry'

export interface MessageEvent {
  'message:fetch': {
    chatId: string
  }

  'message:fetch:progress': {
    taskId: string
    progress: number
  }

  'message:fetch:abort': {
    taskId: string
  }

  'message:process': {
    message: Api.Message
  }

  'message:record': {
    message: Api.Message
  }
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

export function useMessageService(
  coreEmitter: CoreEmitter,
  client: TelegramClient,
) {
  const logger = useLogger()

  // TODO: worker_threads?
  function processMessage(message: Api.Message) {
    // const _internalMessage = toInternalMessage(message)

    // TODO: Save to db

    coreEmitter.emit('message:process', { message })
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

      while (hasMore) {
        try {
          const messages = await withRetry(() => client.getMessages(chatId, {
            limit,
            offsetId,
            minId,
            maxId,
          }))

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
          logger.withError(error).error('Fetch messages failed')
          return withResult(null, error)
        }
      }
    },
  }
}
