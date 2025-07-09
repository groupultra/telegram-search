import type { CorePagination } from '@tg-search/common/utils/pagination'

import type { CoreContext } from '../context'
import type { MessageResolverRegistryFn } from '../message-resolvers'
import type { CoreMessage } from '../utils/message'

import { useLogger } from '@tg-search/common'
import { Err, Ok } from '@tg-search/result'
import { Api } from 'telegram'

import { convertToCoreMessage } from '../utils/message'

export interface MessageEventToCore {
  'message:fetch': (data: { chatId: string, pagination: CorePagination }) => void
  'message:fetch:abort': (data: { taskId: string }) => void
  'message:process': (data: { messages: Api.Message[] }) => void
  'message:send': (data: { chatId: string, content: string }) => void
}

export interface MessageEventFromCore {
  'message:fetch:progress': (data: { taskId: string, progress: number }) => void
  'message:data': (data: { messages: CoreMessage[] }) => void
}

export type MessageEvent = MessageEventFromCore & MessageEventToCore

export interface FetchMessageOpts {
  chatId: string
  pagination: CorePagination

  startTime?: Date
  endTime?: Date

  // Filter
  skipMedia?: boolean
  messageTypes?: string[]

  // Incremental export
  minId?: number
  maxId?: number
}

export type MessageService = ReturnType<ReturnType<typeof createMessageService>>

export function createMessageService(ctx: CoreContext) {
  const logger = useLogger('core:message:service')

  return (resolvers: MessageResolverRegistryFn) => {
    const { emitter, getClient, withError } = ctx

    // TODO: worker_threads?
    async function processMessages(messages: Api.Message[]) {
      logger.withFields({ count: messages.length }).verbose('Process messages')

      const coreMessages = messages
        .map(message => convertToCoreMessage(message).orUndefined())
        .filter(message => message != null)

      logger.withFields({ count: coreMessages.length }).debug('Converted messages')

      // TODO: Query user database to get user info

      // Return the messages first
      emitter.emit('message:data', { messages: coreMessages })

      // Storage the messages first
      emitter.emit('storage:record:messages', { messages: coreMessages })

      // Embedding or resolve messages
      for (const [name, resolver] of resolvers.registry.entries()) {
        logger.withFields({ name }).verbose('Process messages with resolver')

        try {
          let result: CoreMessage[] = []

          if (resolver.run) {
            result = (await resolver.run({ messages: coreMessages })).unwrap()
          }
          else if (resolver.stream) {
            for await (const message of resolver.stream({ messages: coreMessages })) {
              result.push(message)
              emitter.emit('message:data', { messages: [message] })
            }
          }

          if (result.length > 0) {
            emitter.emit('storage:record:messages', { messages: result })
          }
        }
        catch (error) {
          logger.withFields({ error }).warn('Failed to process messages')
        }
      }
    }

    async function* fetchMessages(
      chatId: string,
      options: Omit<FetchMessageOpts, 'chatId'>,
    ): AsyncGenerator<Api.Message> {
      if (!await getClient().isUserAuthorized()) {
        logger.error('User not authorized')
        return
      }

      const limit = options.pagination.limit
      const minId = options?.minId
      const maxId = options?.maxId

      logger.withFields({
        chatId,
        limit,
        minId,
        maxId,
      }).verbose('Fetch messages options')

      try {
        logger.withFields({ limit }).debug('Fetching messages from Telegram server')
        const messages = await getClient()
          .getMessages(chatId, {
            limit,
            minId,
            maxId,
            addOffset: options.pagination.offset, // TODO: rename this
          })

        if (messages.length === 0) {
          logger.error('Get messages failed or returned empty data')
          return Err(new Error('Get messages failed or returned empty data'))
        }

        for (const message of messages) {
          // Skip empty messages
          if (message instanceof Api.MessageEmpty) {
            continue
          }

          yield message
        }
      }
      catch (error) {
        return Err(withError(error, 'Fetch messages failed'))
      }
    }

    async function sendMessage(chatId: string, content: string) {
      const message = await getClient()
        .invoke(new Api.messages.SendMessage({
          peer: chatId,
          message: content,
        }))

      return Ok(message)
    }

    return {
      processMessages,
      fetchMessages,
      sendMessage,
    }
  }
}
