import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { ConnectionService } from '../services'

import { StringSession } from 'telegram/sessions'

import { safeOn } from '../context'
import { AuthLogin, AuthLogout } from '../types/events'

export function registerAuthEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:auth:event')

  return (
    configuredConnectionService: ConnectionService,
  ) => {
    safeOn(ctx.eventContext, AuthLogin, async ({ phoneNumber, session }) => {
      if (phoneNumber) {
        await configuredConnectionService.loginWithPhone(phoneNumber)
        return
      }

      if (session) {
        logger.verbose('Using client-provided session')
        await configuredConnectionService.loginWithSession(new StringSession(session))
      }
    }, logger)

    safeOn(ctx.eventContext, AuthLogout, async () => {
      logger.verbose('Logged out from Telegram')
      const client = ctx.getClient()
      if (client) {
        await configuredConnectionService.logout(client)
      }
    }, logger)
  }
}
