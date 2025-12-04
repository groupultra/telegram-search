import type { AccountSettings } from '../types/account-settings'

import { safeParse } from 'valibot'

import { accountSettingsSchema } from '../types/account-settings'

export function generateDefaultAccountSettings(): AccountSettings {
  const defaultSettings = safeParse(accountSettingsSchema, {})

  if (!defaultSettings.success) {
    throw new Error('Failed to generate default account settings', { cause: defaultSettings.issues })
  }

  return defaultSettings.output
}
