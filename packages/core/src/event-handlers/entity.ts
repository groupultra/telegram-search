import type { CoreContext } from '../context'
import type { EntityService } from '../services/entity'

import { useLogger } from '@unbird/logg'

export function registerEntityEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:entity:event')

  return (entityService: EntityService) => {
    emitter.on('entity:me:fetch', async () => {
      logger.verbose('Getting me info')
      await entityService.getMeInfo()
    })
  }
}
