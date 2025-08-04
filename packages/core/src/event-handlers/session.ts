import type { CoreContext } from '../context'
import type { SessionService } from '../services'

import { useLogger } from '@unbird/logg'

export function registerSessionEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:session:event')

  return (sessionService: SessionService) => {
    emitter.on('session:clean', async ({ phoneNumber }) => {
      logger.withFields({ phoneNumber }).verbose('Cleaning session')
      await sessionService.cleanSession(phoneNumber)
    })

    emitter.on('session:update', async ({ phoneNumber, session }) => {
      logger.withFields({ phoneNumber }).verbose('Saving session')
      await sessionService.saveSession(phoneNumber, session)
    })
  }
}
