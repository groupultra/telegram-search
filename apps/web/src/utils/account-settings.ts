import type { AccountSettings, CoreEventType } from '@tg-search/core'
import type { WsEventToClientData } from '@tg-search/server/types'

import { deepClone } from '@tg-search/common'
import { normalizeAccountSettings } from '@tg-search/core'

export function buildDefaultMessageProcessing() {
  return {
    receiveMessages: { receiveAll: true, downloadMedia: true },
    resolvers: { disabledResolvers: ['avatar'] },
    defaults: { syncMedia: true, maxMediaSize: 0 },
    enablePhotoEmbedding: false,
  }
}

function buildDefaultVisionLLM() {
  return {
    model: '',
    apiKey: '',
    apiBase: '',
    temperature: 0.7,
    maxTokens: 1024,
  }
}

export function ensureAccountSettingsDefaults(settings: AccountSettings): AccountSettings {
  const normalizedSettings = normalizeAccountSettings(settings)
  Object.assign(settings, normalizedSettings)
  settings.visionLLM ??= buildDefaultVisionLLM()
  return settings
}

export function createAccountSettingsSavePayload(settings: AccountSettings): AccountSettings {
  const snapshot = deepClone(settings)
  if (!snapshot) {
    throw new Error('Failed to clone account settings for save')
  }

  return ensureAccountSettingsDefaults(snapshot)
}

export function isMatchingAccountSettingsResponse(
  response: WsEventToClientData<CoreEventType.ConfigData>,
  expectedSettings: AccountSettings,
): boolean {
  return JSON.stringify(createAccountSettingsSavePayload(response.accountSettings))
    === JSON.stringify(expectedSettings)
}
