import type { CoreContext } from '../context'
import type { ConnectionService, SessionService } from '../services'

import { useLogger } from '@unbird/logg'

export function registerAuthEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:auth:event')

  return (
    configuredConnectionService: ConnectionService,
    sessionService: SessionService,
  ) => {
    emitter.on('auth:login', async ({ phoneNumber }) => {
      const session = (await sessionService.loadSession(phoneNumber)).expect('Failed to load session')

      logger.withFields({ session }).verbose('Loaded session')

      await configuredConnectionService.login({ phoneNumber, session })
      logger.verbose('Logged in to Telegram')
    })

    emitter.on('auth:logout', async () => {
      logger.verbose('Logged out from Telegram')
      const client = ctx.getClient()
      if (client) {
        await configuredConnectionService.logout(client)
      }
    })
  }
}
