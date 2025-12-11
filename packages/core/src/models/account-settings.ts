import type { CoreDB } from '../db'
import type { AccountSettings } from '../types/account-settings'
import type { PromiseResult } from '../utils/result'
import type { DBInsertAccount } from './utils/types'

import { eq } from 'drizzle-orm'
import { safeParse } from 'valibot'

import { accountsTable } from '../schemas/accounts'
import { accountSettingsSchema } from '../types/account-settings'
import { generateDefaultAccountSettings } from '../utils/account-settings'
import { withResult } from '../utils/result'
import { must0 } from './utils/must'

/**
 * Update settings for a specific account
 */
export async function updateAccountSettings(
  db: CoreDB,
  accountId: string,
  settings: Partial<AccountSettings>,
): Promise<DBInsertAccount> {
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

  return must0(updatedRows)
}

/**
 * Fetch settings by accountId
 */
export async function fetchSettingsByAccountId(db: CoreDB, accountId: string): PromiseResult<AccountSettings> {
  return withResult(async () => {
    const result = await db
      .select({ settings: accountsTable.settings })
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .limit(1)

    if (result.length > 0 && result[0].settings) {
      const parsedSettings = safeParse(accountSettingsSchema, result[0].settings)
      if (parsedSettings.success) {
        return parsedSettings.output
      }
    }

    return generateDefaultAccountSettings()
  })
}
