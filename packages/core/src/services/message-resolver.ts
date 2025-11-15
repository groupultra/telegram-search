import type { Api } from 'telegram'

import type { CoreContext } from '../context'
import type { MessageResolverRegistryFn } from '../message-resolvers'
import type { SyncOptions } from '../types/events'

import { useLogger } from '@guiiai/logg'
import { useConfig } from '@tg-search/common'

import { convertToCoreMessage } from '../utils/message'

export type MessageResolverService = ReturnType<ReturnType<typeof createMessageResolverService>>

export function createMessageResolverService(ctx: CoreContext) {
  const logger = useLogger('core:message-resolver:service')

  return (resolvers: MessageResolverRegistryFn) => {
    const { emitter } = ctx

    // TODO: worker_threads?
    async function processMessages(messages: Api.Message[], options: { takeout?: boolean, syncOptions?: SyncOptions } = {}) {
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

      // Avatar resolver prefetch is disabled by default.
      // Rationale: avatar loading is now on-demand and driven by frontend requests
      // (entity:avatar:fetch / dialog:avatar:fetch). This avoids redundant downloads
      // when the client already has cached or persisted avatars.
      // We keep the resolver registered but filtered by disabled list so it can be
      // re-enabled later if a prefetch strategy is desired.
      let disabledResolvers = useConfig().resolvers.disabledResolvers || []
      const set = new Set(disabledResolvers)
      set.add('avatar')
      disabledResolvers = Array.from(set)

      // Embedding or resolve messages
      const promises = Array.from(resolvers.registry.entries())
        .filter(([name]) => !disabledResolvers.includes(name))
        .map(([name, resolver]) => (async () => {
          logger.withFields({ name }).verbose('Process messages with resolver')

          try {
            if (resolver.run) {
              const result = (await resolver.run({ messages: coreMessages, syncOptions: options.syncOptions })).unwrap()

              if (result.length > 0) {
                emitter.emit('storage:record:messages', { messages: result })
              }
            }
            else if (resolver.stream) {
              for await (const message of resolver.stream({ messages: coreMessages, syncOptions: options.syncOptions })) {
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
