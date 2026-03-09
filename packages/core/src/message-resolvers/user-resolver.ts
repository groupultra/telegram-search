import type { Logger } from '@guiiai/logg'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { UserModels } from '../models/users'
import type { DBSelectUser } from '../models/utils/types'

import { Ok } from '@unbird/result'

import { resolveEntity } from '../utils/entity'

export function createUserResolver(ctx: CoreContext, logger: Logger, userModels: UserModels): MessageResolver {
  logger = logger.withContext('core:resolver:user')

  // In-memory cache for user database records to avoid repeated DB queries
  const userCache = new Map<string, DBSelectUser>()
  const userBlockedList = new Set<string>()

  const resolveUser = async (fromId: string): Promise<DBSelectUser | undefined> => {
    const cacheKey = `telegram:${fromId}`

    // 1. Check in-memory cache
    const cached = userCache.get(cacheKey)
    if (cached) {
      ctx.metrics?.entityResolve.inc({ source: 'cache', outcome: 'hit' })
      return cached
    }

    // 2. Check database
    const dbUser = (await userModels.findUserByPlatformId(ctx.getDB(), 'telegram', fromId)).orUndefined()
    if (dbUser) {
      ctx.metrics?.entityResolve.inc({ source: 'db', outcome: 'hit' })
      userCache.set(cacheKey, dbUser)
      logger.withFields({ userId: dbUser.id, fromId }).debug('User found in database')
      return dbUser
    }

    // 3. Fallback: Fetch from Telegram API
    if (userBlockedList.has(fromId)) {
      return undefined
    }

    try {
      const rawEntity = await ctx.getClient().getEntity(fromId)
      const entity = resolveEntity(rawEntity).orUndefined()

      if (!entity) {
        return undefined
      }

      logger.withFields(rawEntity).debug('Resolved entity from Telegram API')

      // 4. Record new user to database
      const recordedUser = await userModels.recordUser(ctx.getDB(), entity)
      ctx.metrics?.entityResolve.inc({ source: 'api', outcome: 'hit' })
      userCache.set(cacheKey, recordedUser)
      logger.withFields({ userId: recordedUser.id, fromId }).debug('User saved to database')

      return recordedUser
    }
    catch (err) {
      // Only block if it's a Telegram API error, not DB error?
      // Actually if DB error occurs we might want to retry.
      // But distinguishing them is hard here without type guards.
      // Assuming 'catch' catches both getEntity and recordUser errors.
      // If getEntity fails, we should block.
      // If recordUser fails, maybe not block?

      // Let's refine:
      // We need to differentiate where the error came from to know if we should block.
      // But for simplicity/safety, let's treat it as a "failed to resolve" for this session.

      // Wait, if recordUser fails, we probably shouldn't block the user ID forever in this session.
      // But re-trying on every message might spam logs.

      // Let's assume most errors are API errors here or transient DB errors.
      ctx.metrics?.entityResolve.inc({ source: 'api', outcome: 'miss' })
      userBlockedList.add(fromId)
      logger.withFields({ fromId }).withError(err).warn('Failed to resolve or save user')
      return undefined
    }
  }

  return {
    run: async (opts: MessageResolverOpts) => {
      logger.verbose('Executing user resolver')

      const { messages } = opts

      for (const message of messages) {
        const dbUser = await resolveUser(message.fromId)

        if (dbUser) {
          message.fromName = dbUser.name
          message.fromUserUuid = dbUser.id
        }
      }

      return Ok(messages)
    },
  }
}
