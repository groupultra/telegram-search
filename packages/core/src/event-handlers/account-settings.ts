import type { CoreContext } from '../context'
import type { AccountSettingsService } from '../services/account-settings'

import { useLogger } from '@guiiai/logg'

export function registerAccountSettingsEventHandlers(ctx: CoreContext) {
  const logger = useLogger('core:account-settings:event')

  return (configService: AccountSettingsService) => {
    ctx.emitter.on('config:fetch', async () => {
      logger.verbose('Getting config')

      configService.fetchAccountSettings()
    })

    ctx.emitter.on('config:update', async ({ accountSettings }) => {
      logger.verbose('Saving config')

      await configService.setAccountSettings(accountSettings)
    })
  }
}
