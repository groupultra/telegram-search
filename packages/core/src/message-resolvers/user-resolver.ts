import type { Entity } from 'telegram/define'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'

import { useLogger } from '@unbird/logg'
import { Ok } from '@unbird/result'

import { resolveEntity } from '../utils/entity'

export function createUserResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:user')

  const entities = new Map<string, Entity>()

  return {
    run: async (opts: MessageResolverOpts) => {
      logger.verbose('Executing user resolver')

      const { messages } = opts

      for (const message of messages) {
        if (!entities.has(message.fromId)) {
          const entity = await ctx.getClient().getEntity(message.fromId)
          entities.set(message.fromId, entity)
          logger.withFields(entity).debug('Resolved entity')
        }

        const entity = entities.get(message.fromId)!
        const result = resolveEntity(entity).orUndefined()
        if (!result) {
          continue
        }

        message.fromName = result.name
      }

      return Ok(messages)
    },
  }
}
