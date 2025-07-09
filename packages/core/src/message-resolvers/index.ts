import type { Result } from '@tg-search/result'

import type { CoreMessage } from '../utils/message'

import { useLogger } from '@tg-search/common'

export interface MessageResolverOpts {
  messages: CoreMessage[]
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
