import type { CoreContext } from '../context'
import type { createSessionService } from '../services'

import { useLogger } from '@tg-search/common'

export function registerSessionEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:session:event')

  return (sessionService: ReturnType<typeof createSessionService>) => {
    emitter.on('session:clean', async ({ phoneNumber }) => {
      logger.withFields({ phoneNumber }).debug('Cleaning session')
      await sessionService.cleanSession(phoneNumber)
    })

    emitter.on('session:save', async ({ phoneNumber, session }) => {
      logger.withFields({ phoneNumber }).debug('Saving session')
      await sessionService.saveSession(phoneNumber, session)
    })
  }
}
