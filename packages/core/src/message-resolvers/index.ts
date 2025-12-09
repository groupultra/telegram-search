import type { Result } from '@unbird/result'
import type { Api } from 'telegram'

import type { SyncOptions } from '../types/events'
import type { CoreMessage } from '../types/message'

import { useLogger } from '@guiiai/logg'

export interface MessageResolverOpts {
  /**
   * Core message projection, UI/DB friendly.
   */
  messages: CoreMessage[]
  /**
   * Raw Telegram messages, kept only for resolvers that need access
   * to original Api.Message structures (e.g. media download).
   */
  rawMessages: Api.Message[]
  syncOptions?: SyncOptions
}

export interface MessageResolver {
  run?: (opts: MessageResolverOpts) => Promise<Result<CoreMessage[]>>
  stream?: (opts: MessageResolverOpts) => AsyncGenerator<CoreMessage>
}

export type MessageResolverRegistryFn = ReturnType<typeof useMessageResolverRegistry>

export function useMessageResolverRegistry() {
  const logger = useLogger('core:resolver:registry')

  const registry = new Map<string, MessageResolver>()

  return {
    register: (name: string, resolver: MessageResolver) => {
      logger.withFields({ name }).verbose('Register resolver')
      registry.set(name, resolver)
    },

    registry,
  }
}
