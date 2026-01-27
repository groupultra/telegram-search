import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { AccountSettings } from '../types'

import { safeParse } from 'valibot'

import { accountSettingsSchema } from '../types'
import { CoreEventType } from '../types/events'

export type AccountSettingsService = ReturnType<typeof createAccountSettingsService>

export function createAccountSettingsService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:account-settings:service')

  async function fetchAccountSettings() {
    logger.verbose('Fetching account settings')

    const accountSettings = await ctx.getAccountSettings()

    ctx.emitter.emit(CoreEventType.ConfigData, { accountSettings })
  }

  async function setAccountSettings(accountSettings: AccountSettings) {
    logger.withFields({ accountSettings }).verbose('Setting account settings')

    const parsedAccountSettings = safeParse(accountSettingsSchema, accountSettings)
    // TODO: handle error
    if (!parsedAccountSettings.success) {
      throw new Error('Invalid config')
    }

    await ctx.setAccountSettings(parsedAccountSettings.output)

    ctx.emitter.emit(CoreEventType.ConfigData, { accountSettings: parsedAccountSettings.output })
  }

  return {
    fetchAccountSettings,
    setAccountSettings,
  }
}
