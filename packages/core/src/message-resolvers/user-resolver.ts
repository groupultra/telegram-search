import type { Entity } from 'telegram/define'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { DBSelectUser } from '../models/users'

import { useLogger } from '@guiiai/logg'
import { Ok } from '@unbird/result'

import { findUserByPlatformId, recordUser } from '../models/users'
import { resolveEntity } from '../utils/entity'

export function createUserResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:user')

  // In-memory cache for entities fetched from Telegram API during this session
  const entities = new Map<string, Entity>()

  // In-memory cache for user database records to avoid repeated DB queries
  const userCache = new Map<string, DBSelectUser>()

  return {
    run: async (opts: MessageResolverOpts) => {
      logger.verbose('Executing user resolver')

      const { messages } = opts

      for (const message of messages) {
        const cacheKey = `telegram:${message.fromId}`

        // Check in-memory cache first
        let dbUser = userCache.get(cacheKey)

        if (!dbUser) {
          // Check database
          const dbUserOrNull = (await findUserByPlatformId('telegram', message.fromId)).orUndefined()

          if (dbUserOrNull) {
            dbUser = dbUserOrNull
            userCache.set(cacheKey, dbUser)
            logger.withFields({ userId: dbUser.id, fromId: message.fromId }).debug('User found in database')
          }
        }

        // If user not found in cache or database, fetch from Telegram API
        if (!dbUser) {
          if (!entities.has(message.fromId)) {
            try {
              const entity = await ctx.getClient().getEntity(message.fromId)
              entities.set(message.fromId, entity)
              logger.withFields(entity).debug('Resolved entity from Telegram API')
            }
            catch {
              // TODO: is there needs access_hash?
              logger.withFields({ fromId: message.fromId }).warn('Failed to get entity from Telegram API')
            }
          }

          const entity = entities.get(message.fromId)!
          const coreEntity = resolveEntity(entity).orUndefined()

          if (!coreEntity) {
            continue
          }

          // Save to database
          const recordedUsers = (await recordUser(coreEntity)).orUndefined()
          if (recordedUsers && recordedUsers.length > 0) {
            dbUser = recordedUsers[0]
            userCache.set(cacheKey, dbUser)
            logger.withFields({ userId: dbUser.id, fromId: message.fromId }).debug('User saved to database')
          }
        }

        // Update message with user information
        if (dbUser) {
          message.fromName = dbUser.name
          message.fromUserUuid = dbUser.id
        }
      }

      return Ok(messages)
    },
  }
}
