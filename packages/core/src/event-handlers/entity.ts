import type { CoreContext } from '../context'
import type { EntityService } from '../services/entity'

import { useLogger } from '@guiiai/logg'

export function registerEntityEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:entity:event')

  return (entityService: EntityService) => {
    emitter.on('entity:me:fetch', async () => {
      logger.verbose('Getting me info')
      await entityService.getMeInfo()
    })

    emitter.on('entity:avatar:fetch', async ({ userId }) => {
      logger.withFields({ userId }).verbose('Fetching user avatar')
      await entityService.fetchUserAvatar(userId)
    })
  }
}
