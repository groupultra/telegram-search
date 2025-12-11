import { safeParse } from 'valibot'
import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountsTable } from '../../schemas/accounts'
import { accountSettingsSchema } from '../../types/account-settings'
import { generateDefaultAccountSettings } from '../../utils/account-settings'
import { fetchSettingsByAccountId, updateAccountSettings } from '../account-settings'

async function setupDb() {
  return mockDB({
    accountsTable,
  })
}

describe('models/account-settings', () => {
  it('fetchSettingsByAccountId returns default settings when account does not exist', async () => {
    const db = await setupDb()

    const result = await fetchSettingsByAccountId(db, 'non-existent-id')
    const settings = result.unwrap()

    expect(settings).toEqual(generateDefaultAccountSettings())
  })

  it('fetchSettingsByAccountId returns parsed settings when present and valid', async () => {
    const db = await setupDb()

    const customSettings = generateDefaultAccountSettings()
    customSettings.embedding.model = 'custom-model'

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
      settings: customSettings,
    }).returning()

    const result = await fetchSettingsByAccountId(db, account.id)
    const settings = result.unwrap()

    expect(settings.embedding?.model).toBe('custom-model')
  })

  it('fetchSettingsByAccountId falls back to default when stored settings are invalid', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
      // Intentionally store invalid settings shape
      settings: { invalid: true } as any,
    }).returning()

    const result = await fetchSettingsByAccountId(db, account.id)
    const settings = result.unwrap()

    expect(settings).toEqual(generateDefaultAccountSettings())
  })

  it('updateAccountSettings updates settings when input is valid', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    const partialSettings = {
      embedding: {
        model: 'text-embedding-3-large',
      },
    }

    const parsed = safeParse(accountSettingsSchema, partialSettings)
    if (!parsed.success) {
      throw new Error('Failed to parse settings', { cause: parsed.issues })
    }

    const result = await updateAccountSettings(db, account.id, parsed.output)
    const updated = result.unwrap()

    expect(updated.settings).toEqual(parsed)
  })

  it('updateAccountSettings throws when settings are invalid', async () => {
    const db = await setupDb()

    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'user-1',
    }).returning()

    await expect(updateAccountSettings(db, account.id, {
      // @ts-expect-error runtime validation should reject invalid enum
      embedding: { dimension: 999 },
    })).rejects.toThrowError('Invalid settings')
  })
})
