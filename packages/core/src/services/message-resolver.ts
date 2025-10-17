import type { Api } from 'telegram'

import type { CoreContext } from '../context'
import type { MessageResolverRegistryFn } from '../message-resolvers'

import { useConfig } from '@tg-search/common'
import { useLogger } from '@unbird/logg'

import { convertToCoreMessage } from '../utils/message'

export interface MessageResolverEventToCore {
  'message:process': (data: { messages: Api.Message[], isTakeout?: boolean }) => void
}

export interface MessageResolverEventFromCore {}

export type MessageResolverEvent = MessageResolverEventFromCore & MessageResolverEventToCore

export type MessageResolverService = ReturnType<ReturnType<typeof createMessageResolverService>>

export function createMessageResolverService(ctx: CoreContext) {
  const logger = useLogger('core:message-resolver:service')

  return (resolvers: MessageResolverRegistryFn) => {
    const { emitter } = ctx

    // TODO: worker_threads?
    async function processMessages(messages: Api.Message[], options: { takeout?: boolean } = {}) {
      logger.withFields({ count: messages.length }).verbose('Process messages')

      const coreMessages = messages
        .map(message => convertToCoreMessage(message).orUndefined())
        .filter(message => message != null)

      logger.withFields({ count: coreMessages.length }).debug('Converted messages')

      // TODO: Query user database to get user info

      // Return the messages first
      if (!options.takeout) {
        emitter.emit('message:data', { messages: coreMessages })
      }

      // Storage the messages first
      emitter.emit('storage:record:messages', { messages: coreMessages })

      const disabledResolvers = useConfig().resolvers.disabledResolvers || []

      // Embedding or resolve messages
      const promises = Array.from(resolvers.registry.entries())
        .filter(([name]) => !disabledResolvers.includes(name))
        .map(([name, resolver]) => (async () => {
          logger.withFields({ name }).verbose('Process messages with resolver')

          try {
            if (resolver.run) {
              const result = (await resolver.run({ messages: coreMessages })).unwrap()

              if (result.length > 0) {
                emitter.emit('storage:record:messages', { messages: result })
              }
            }
            else if (resolver.stream) {
              for await (const message of resolver.stream({ messages: coreMessages })) {
                if (!options.takeout) {
                  emitter.emit('message:data', { messages: [message] })
                }

                emitter.emit('storage:record:messages', { messages: [message] })
              }
            }
          }
          catch (error) {
            logger.withError(error).warn('Failed to process messages')
          }
        })())

      await Promise.allSettled(promises)
    }

    return {
      processMessages,
    }
  }
}
