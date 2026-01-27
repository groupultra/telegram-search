import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { ConnectionService } from '../services'

import { StringSession } from 'telegram/sessions'

import { CoreEventType } from '../types/events'

export function registerAuthEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:auth:event')

  return (
    configuredConnectionService: ConnectionService,
  ) => {
    ctx.emitter.on(CoreEventType.AuthLogin, async ({ phoneNumber, session }) => {
      if (phoneNumber) {
        return configuredConnectionService.loginWithPhone(phoneNumber)
      }

      if (session) {
        logger.verbose('Using client-provided session')
        return configuredConnectionService.loginWithSession(new StringSession(session))
      }
    })

    ctx.emitter.on(CoreEventType.AuthLogout, async () => {
      logger.verbose('Logged out from Telegram')
      const client = ctx.getClient()
      if (client) {
        await configuredConnectionService.logout(client)
      }
    })
  }
}
