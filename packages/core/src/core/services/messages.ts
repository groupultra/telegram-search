import type { TelegramClient } from 'telegram'
import type { TelegramMessage, TelegramMessageType } from '../../types'
import type { CoreEmitter } from '../client'
import type { PromiseResult } from '../utils/result'

import { useLogger } from '@tg-search/common'
import bigInt from 'big-integer'
import { Api } from 'telegram'

import { withResult } from '../utils/result'
import { withRetry } from '../utils/retry'

export interface MessageEvent {
  'message:fetch': {
    chatId: string
  }

  'message:progress': {
    taskId: string
    progress: number
  }

  'message:abort': {
    taskId: string
  }

  'message:process': {
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
    const _internalMessage = toInternalMessage(message)

    // TODO: Save to db

    coreEmitter.emit('message:process', { message })
  }

  function toInternalMessage(message: Api.Message): TelegramMessage {
    return {
      id: message.id,
      chatId: message.chatId?.toString(),
      type: message.media ? 'media' : 'text',
      createdAt: new Date(message.date * 1000),
      text: message.message,
      media: message.media,
    }
  }

  return {
    async* fetchMessages(
      chatId: string,
      options: Omit<FetchMessageOpts, 'chatId'>,
    ): AsyncGenerator<Api.Message> {
      let offsetId = 0
      let hasMore = true
      let processedCount = 0
      const limit = options.limit || 100

      while (hasMore) {
        try {
          const messages = await withRetry(() => client.getMessages(chatId, {
            limit,
            offsetId,
            minId: options?.minId || 0,
            maxId: options?.maxId || 0,
          }))

          if (messages.length === 0) {
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
            if (options?.startTime && messageTime < options.startTime) {
              continue
            }
            if (options?.endTime && messageTime > options.endTime) {
              continue
            }

            processMessage(message)

            yield message
            processedCount++

            // Update offsetId to current message ID
            offsetId = message.id

            // Check if we've reached the limit
            if (options?.limit && processedCount >= options.limit) {
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

    async getHistory(chatId: string): PromiseResult<Api.messages.TypeMessages & { count: number } | null> {
      try {
        const result = await withRetry(() =>
          client.invoke(new Api.messages.GetHistory({
            peer: chatId,
            limit: 1,
            offsetId: 0,
            offsetDate: 0,
            addOffset: 0,
            maxId: 0,
            minId: 0,
            hash: bigInt(0),
          }))) as Api.messages.TypeMessages & { count: number }
        return withResult(result, null)
      }
      catch (error) {
        logger.withError(error).error('Get history failed')
        return withResult(null, error)
      }
    },
  }
}
