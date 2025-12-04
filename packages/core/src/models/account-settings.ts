import type { Result } from '@unbird/result'

import type { AccountSettings } from '../types/account-settings'

import { Err, Ok } from '@unbird/result'
import { eq } from 'drizzle-orm'
import { safeParse } from 'valibot'

import { withDb } from '../db'
import { accountsTable } from '../schemas/accounts'
import { accountSettingsSchema } from '../types/account-settings'

/**
 * Fetch settings by accountId
 */
export async function fetchSettingsByAccountId(accountId: string): Promise<Result<AccountSettings>> {
  const result = (await withDb(async db => await db
    .select({ settings: accountsTable.settings })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1),
  )).expect('Failed to fetch account settings')

  if (result.length > 0 && result[0].settings)
    return Ok(result[0].settings)
  else
    return Err('Failed to fetch account settings')
}

/**
 * Update settings for a specific account
 */
export async function updateAccountSettings(
  accountId: string,
  settings: Partial<AccountSettings>,
) {
  const parsedSettings = safeParse(accountSettingsSchema, settings)
  if (!parsedSettings.success) {
    return Err('Invalid settings')
  }

  return (await withDb(async (db) => {
    // Only update the "settings" column (which is a JSONB), not the root row fields
    const updatedRows = await db
      .update(accountsTable)
      .set({ settings: parsedSettings.output })
      .where(eq(accountsTable.id, accountId))
      .returning()

    return updatedRows.length > 0 ? Ok(updatedRows[0]) : Err('Failed to update account settings')
  })).expect('Failed to update account settings')
}
