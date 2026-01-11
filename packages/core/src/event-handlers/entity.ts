import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { EntityService } from '../services/entity'

export function registerEntityEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:entity:event')

  return (entityService: EntityService) => {
    ctx.emitter.on('entity:process', async ({ users, chats }) => {
      // GramJS entities are automatically handled by the client's internal entity cache
      // when we invoke any method, but we ALSO manually persist them to DB to ensure
      // we have persistent accessHash for future API calls.
      logger.withFields({ users: users.length, chats: chats.length }).debug('Processing entities from sync')
      await entityService.processEntities(users, chats)
    })

    ctx.emitter.on('entity:avatar:fetch', async ({ userId, fileId }) => {
      logger.withFields({ userId, fileId }).debug('Fetching user avatar')
      await entityService.fetchUserAvatar(userId, fileId)
    })

    ctx.emitter.on('entity:avatar:prime-cache', async ({ userId, fileId }) => {
      logger.withFields({ userId, fileId }).debug('Priming avatar cache')
      await entityService.primeUserAvatarCache(userId, fileId)
    })

    ctx.emitter.on('entity:chat-avatar:prime-cache', async ({ chatId, fileId }) => {
      logger.withFields({ chatId, fileId }).debug('Priming chat avatar cache')
      await entityService.primeChatAvatarCache(chatId, fileId)
    })
  }
}
