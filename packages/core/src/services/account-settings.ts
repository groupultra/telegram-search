import type { CoreContext } from '../context'
import type { AccountSettings } from '../types'

import { safeParse } from 'valibot'

import { accountSettingsSchema } from '../types'

export type AccountSettingsService = ReturnType<typeof createAccountSettingsService>

export function createAccountSettingsService(ctx: CoreContext) {
  async function fetchAccountSettings() {
    const accountSettings = await ctx.getAccountSettings()

    ctx.emitter.emit('config:data', { accountSettings })
  }

  async function setAccountSettings(accountSettings: AccountSettings) {
    const parsedAccountSettings = safeParse(accountSettingsSchema, accountSettings)
    // TODO: handle error
    if (!parsedAccountSettings.success) {
      throw new Error('Invalid config')
    }

    await ctx.setAccountSettings(parsedAccountSettings.output)

    ctx.emitter.emit('config:data', { accountSettings: parsedAccountSettings.output })
  }

  return {
    fetchAccountSettings,
    setAccountSettings,
  }
}
