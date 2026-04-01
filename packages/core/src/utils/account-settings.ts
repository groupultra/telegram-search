import type { AccountSettings } from '../types/account-settings'

import { safeParse } from 'valibot'

import { accountSettingsSchema } from '../types/account-settings'

// TODO: move to a more appropriate place
export function generateDefaultAccountSettings(): AccountSettings {
  const defaultSettings = safeParse(accountSettingsSchema, {})

  if (!defaultSettings.success) {
    throw new Error('Failed to generate default account settings', { cause: defaultSettings.issues })
  }

  return defaultSettings.output
}

export function normalizeAccountSettings(settings: AccountSettings): AccountSettings {
  const legacyReceiveMessages = settings.receiveMessages
  const legacyResolvers = settings.resolvers
  const hasNestedReceiveMessages = settings.messageProcessing?.receiveMessages != null
  const hasNestedResolvers = settings.messageProcessing?.resolvers != null

  const parsedSettings = safeParse(accountSettingsSchema, settings)
  if (!parsedSettings.success) {
    throw new Error('Failed to normalize account settings', { cause: parsedSettings.issues })
  }

  const normalized = parsedSettings.output
  const messageProcessing = normalized.messageProcessing ?? {}
  const receiveMessages = hasNestedReceiveMessages
    ? messageProcessing.receiveMessages
    : (legacyReceiveMessages ?? normalized.receiveMessages ?? {
        receiveAll: true,
        downloadMedia: true,
      })
  const resolvers = hasNestedResolvers
    ? messageProcessing.resolvers
    : (legacyResolvers ?? normalized.resolvers ?? {
        disabledResolvers: ['avatar'],
      })

  normalized.messageProcessing = {
    ...messageProcessing,
    receiveMessages: {
      receiveAll: receiveMessages.receiveAll ?? true,
      downloadMedia: receiveMessages.downloadMedia ?? true,
    },
    resolvers: {
      disabledResolvers: resolvers.disabledResolvers ?? ['avatar'],
    },
    // Preserve existing defaults while ensuring the required fields exist.
    // NOTICE: legacy settings never stored these under top-level keys, so we
    // only default them when the nested object is absent.
    defaults: {
      syncMedia: messageProcessing.defaults?.syncMedia ?? true,
      maxMediaSize: messageProcessing.defaults?.maxMediaSize ?? 0,
      ...(messageProcessing.defaults?.skipEmbedding != null ? { skipEmbedding: messageProcessing.defaults.skipEmbedding } : {}),
      ...(messageProcessing.defaults?.skipJieba != null ? { skipJieba: messageProcessing.defaults.skipJieba } : {}),
    },
    enablePhotoEmbedding: messageProcessing.enablePhotoEmbedding ?? false,
  }

  normalized.receiveMessages = normalized.messageProcessing.receiveMessages
  normalized.resolvers = normalized.messageProcessing.resolvers

  return normalized
}
