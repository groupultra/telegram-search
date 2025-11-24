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
      const stringSession = new StringSession(session ?? '')

      logger.withFields({ hasSession: !!session }).verbose('Using client-provided session')

      await configuredConnectionService.login({ phoneNumber, session: stringSession })
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
