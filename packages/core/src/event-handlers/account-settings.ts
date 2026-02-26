import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { AccountSettingsService } from '../services/account-settings'

import { ConfigFetch, ConfigUpdate } from '../types/events'

export function registerAccountSettingsEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:account-settings:event')

  return (configService: AccountSettingsService) => {
    ctx.emitter.on(ConfigFetch, async () => {
      logger.verbose('Getting config')

      configService.fetchAccountSettings()
    })

    ctx.emitter.on(ConfigUpdate, async ({ accountSettings }) => {
      logger.verbose('Saving config')

      await configService.setAccountSettings(accountSettings)
    })
  }
}
