import type { CoreContext } from '../context'
import type { ConnectionService } from '../services'

import { useLogger } from '@guiiai/logg'
import { StringSession } from 'telegram/sessions'

export function registerBasicEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:auth:event')

  return (
    configuredConnectionService: ConnectionService,
  ) => {
    emitter.on('auth:login', async ({ phoneNumber, session }) => {
      if (phoneNumber) {
        return configuredConnectionService.loginWithPhone(phoneNumber)
      }

      if (session) {
        logger.verbose('Using client-provided session')
        return configuredConnectionService.loginWithSession(new StringSession(session))
      }
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
