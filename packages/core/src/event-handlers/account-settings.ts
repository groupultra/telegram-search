import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { AccountSettingsService } from '../services/account-settings'

import { defineInvokeHandler } from '@moeru/eventa'

import { ConfigFetchInvoke, ConfigUpdateInvoke } from '../types/events'

export function registerAccountSettingsEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:account-settings:event')

  return (configService: AccountSettingsService) => {
    defineInvokeHandler(ctx.eventContext, ConfigFetchInvoke, async () => {
      logger.verbose('Getting config')
      return configService.fetchAccountSettings()
    })

    defineInvokeHandler(ctx.eventContext, ConfigUpdateInvoke, async ({ accountSettings }) => {
      logger.verbose('Saving config')
      return configService.setAccountSettings(accountSettings)
    })
  }
}
