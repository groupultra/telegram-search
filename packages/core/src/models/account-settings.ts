import type { CoreDB } from '../db'
import type { AccountSettings } from '../types/account-settings'

import { Ok } from '@unbird/result'
import { eq } from 'drizzle-orm'
import { safeParse } from 'valibot'

import { accountsTable } from '../schemas/accounts'
import { accountSettingsSchema } from '../types/account-settings'
import { generateDefaultAccountSettings } from '../utils/account-settings'
import { must0 } from './utils/must'

/**
 * Fetch settings by accountId
 */
export async function fetchSettingsByAccountId(db: CoreDB, accountId: string) {
  const result = await db
    .select({ settings: accountsTable.settings })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1)

  if (result.length > 0 && result[0].settings) {
    const parsedSettings = safeParse(accountSettingsSchema, result[0].settings)
    if (parsedSettings.success) {
      return Ok(parsedSettings.output)
    }
  }

  return Ok(generateDefaultAccountSettings())
}

/**
 * Update settings for a specific account
 */
export async function updateAccountSettings(
  db: CoreDB,
  accountId: string,
  settings: Partial<AccountSettings>,
) {
  const parsedSettings = safeParse(accountSettingsSchema, settings)
  if (!parsedSettings.success) {
    throw new Error('Invalid settings', { cause: parsedSettings.issues })
  }

  // Only update the "settings" column (which is a JSONB), not the root row fields
  const updatedRows = await db
    .update(accountsTable)
    .set({ settings: parsedSettings.output })
    .where(eq(accountsTable.id, accountId))
    .returning()

  return Ok(must0(updatedRows))
}
