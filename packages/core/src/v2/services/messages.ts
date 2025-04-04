import type { EntityLike } from 'telegram/define'
import type { TelegramMessageType } from '../../types'
import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'

import { useLogger } from '@tg-search/common'
import bigInt from 'big-integer'
import { Api } from 'telegram'

import { withResult } from '../utils/result'
import { withRetry } from '../utils/retry'

// interface CoreMessage {
//   id: number
//   chatId: number
//   type: 'text' | 'media'
//   createdAt: Date
//   text: string
// }

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
  const { emitter, getClient, withError } = ctx

  // TODO: worker_threads?
  function processMessage(message: Api.Message) {
    useLogger().withFields(message).debug('Process message')
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

  async function getHistory(chatId: EntityLike): PromiseResult<(Api.messages.TypeMessages & { count: number }) | null> {
    try {
      const history = await withRetry(
        () => getClient().invoke(new Api.messages.GetHistory({
          peer: chatId,
          limit: 1,
          offsetId: 0,
          offsetDate: 0,
          addOffset: 0,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        })),
      ) as Api.messages.TypeMessages & { count: number }

      return withResult(history, null)
    }
    catch (error) {
      return withResult(null, withError(error, 'Failed to get history'))
    }
  }

  return {
    processMessage,

    getHistory,

    async* fetchMessages(
      chatId: string,
      options: Omit<FetchMessageOpts, 'chatId'>,
    ): AsyncGenerator<Api.Message> {
      if (!await getClient().isUserAuthorized()) {
        useLogger().error('User not authorized')
        return
      }

      let offsetId = 0
      let hasMore = true
      let processedCount = 0

      const limit = options.limit || 100
      const minId = options?.minId
      const maxId = options?.maxId
      const startTime = options?.startTime
      const endTime = options?.endTime

      useLogger().withFields({ chatId, limit, minId, maxId, startTime, endTime }).debug('Fetch messages options')

      // const entity = await getClient().getInputEntity(Number(chatId))

      // const dialog = await getClient().invoke(new Api.messages.GetPeerDialogs({
      //   peers: [new Api.PeerChat({ chatId: BigInt(Number(chatId)) })],
      // }))
      // useLogger().withFields({ chatId, name: dialog.peer.className, json: dialog.toJSON() }).debug('Got dialog')

      const { data: history, error } = await getHistory(chatId)
      if (error || !history) {
        return
      }

      useLogger().withFields({ chatId, count: history?.count }).debug('Got history')

      // await getClient().getDialogs()

      // const chat = dialogs.find(d => d.id?.toString() === chatId)
      // if (!chat) {
      //   throw new Error(`Chat not found: ${chatId}`)
      // }

      while (hasMore) {
        try {
          const messages = await withRetry(
            () => getClient().getMessages(chatId, {
              limit,
              offsetId,
              minId,
              maxId,
            }),
          )

          if (messages.length === 0) {
            useLogger().error('Get messages failed or returned empty data')
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
