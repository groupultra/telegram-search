import type { CoreContext } from '../context'
import type { createConnectionService, createSessionService } from '../services'

import { useLogger } from '@tg-search/common'

export function registerAuthEventHandlers(ctx: CoreContext) {
  const { emitter, withError } = ctx
  const logger = useLogger('core:auth:event')

  return (
    configuredConnectionService: ReturnType<ReturnType<typeof createConnectionService>>,
    sessionService: ReturnType<typeof createSessionService>,
  ) => {
    emitter.on('auth:login', async ({ phoneNumber }) => {
      const { data: session, error: sessionError } = await sessionService.loadSession(phoneNumber)
      if (sessionError) {
        return withError(sessionError, 'Failed to load session')
      }

      logger.withFields({ session }).debug('Loaded session')

      const { error: loginError } = await configuredConnectionService.login({ phoneNumber, session })
      if (loginError) {
        return withError(loginError, 'Failed to login to Telegram')
      }
    })

    emitter.on('auth:logout', async () => {
      logger.debug('Logged out from Telegram')
      const client = ctx.getClient()
      if (client) {
        await configuredConnectionService.logout(client)
      }
    })
  }
}
