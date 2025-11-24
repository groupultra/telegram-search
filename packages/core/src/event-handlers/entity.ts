import type { CoreContext } from '../context'
import type { EntityService } from '../services/entity'

import { useLogger } from '@guiiai/logg'

import { recordAccount } from '../models'

export function registerEntityEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:entity:event')

  return (entityService: EntityService) => {
    emitter.on('entity:me:fetch', async () => {
      logger.verbose('Getting me info')
      const meInfo = (await entityService.getMeInfo()).expect('Failed to get me info')

      // Record account and set current account ID
      logger.withFields({ userId: meInfo.id }).verbose('Recording account for current user')

      const [account] = (await recordAccount('telegram', meInfo.id))?.expect('Failed to record account')
      ctx.setCurrentAccountId(account.id)

      logger.withFields({ accountId: account.id }).verbose('Set current account ID')
    })

    emitter.on('entity:avatar:fetch', async ({ userId, fileId }) => {
      logger.withFields({ userId, fileId }).debug('Fetching user avatar')
      await entityService.fetchUserAvatar(userId, fileId)
    })

    emitter.on('entity:avatar:prime-cache', async ({ userId, fileId }) => {
      logger.withFields({ userId, fileId }).debug('Priming avatar cache')
      await entityService.primeUserAvatarCache(userId, fileId)
    })

    emitter.on('entity:chat-avatar:prime-cache', async ({ chatId, fileId }) => {
      logger.withFields({ chatId, fileId }).debug('Priming chat avatar cache')
      await entityService.primeChatAvatarCache(chatId, fileId)
    })
  }
}
