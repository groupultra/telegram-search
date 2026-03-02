import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { AccountSettingsService } from '../services/account-settings'

import { defineInvokeHandler } from '@moeru/eventa'

import { configFetchInvoke, configUpdateInvoke } from '../events'

export function registerAccountSettingsEventHandlers(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:account-settings:event')

  return (configService: AccountSettingsService) => {
    defineInvokeHandler(ctx.ctx, configFetchInvoke, async () => {
      logger.verbose('Getting config')
      const accountSettings = await configService.fetchAccountSettings()
      return { accountSettings }
    })

    defineInvokeHandler(ctx.ctx, configUpdateInvoke, async ({ accountSettings }) => {
      logger.verbose('Saving config')
      const updated = await configService.setAccountSettings(accountSettings)
      return { accountSettings: updated }
    })
  }
}
