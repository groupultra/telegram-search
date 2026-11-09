import type { VectorSettings } from '@tg-search/protocol'

import type { CoreDB } from '../db'
import type { PromiseResult } from '../utils/result'

import { vectorSettingsSchema } from '@tg-search/protocol'
import { eq } from 'drizzle-orm'
import { safeParse } from 'valibot'

import { systemSettingsTable } from '../schemas/system-settings'
import { withResult } from '../utils/result'

const VECTOR_SETTINGS_KEY = 'vector'

// Installations without a stored row keep the behavior they had before the switch existed.
const DEFAULT_VECTOR_SETTINGS: VectorSettings = { enabled: true }

async function getVectorSettings(db: CoreDB): PromiseResult<VectorSettings> {
  return withResult(async () => {
    const rows = await db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, VECTOR_SETTINGS_KEY))
      .limit(1)
    if (rows.length === 0)
      return DEFAULT_VECTOR_SETTINGS
    const parsed = safeParse(vectorSettingsSchema, rows[0].value)
    if (!parsed.success)
      throw new Error('Stored vector settings are invalid', { cause: parsed.issues })
    return parsed.output
  })
}

async function setVectorSettings(db: CoreDB, settings: VectorSettings): PromiseResult<VectorSettings> {
  return withResult(async () => {
    await db
      .insert(systemSettingsTable)
      .values({ key: VECTOR_SETTINGS_KEY, value: settings })
      .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: settings, updated_at: Date.now() } })
    return settings
  })
}

export const systemSettingsModels = {
  getVectorSettings,
  setVectorSettings,
}

export type SystemSettingsModels = typeof systemSettingsModels
