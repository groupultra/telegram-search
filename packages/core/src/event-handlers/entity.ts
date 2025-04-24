import type { CoreContext } from '../context'
import type { createEntityService } from '../services/entity'

import { useLogger } from '@tg-search/common'

export function registerEntityEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:entity:event')

  return (entityService: ReturnType<typeof createEntityService>) => {
    emitter.on('entity:getMe', async () => {
      logger.debug('Getting me info')
      await entityService.getMeInfo()
    })
  }
}
