import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { AccountSettings } from '../types'

import { toSafePresenceFlag } from '@tg-search/common'
import { safeParse } from 'valibot'

import { accountSettingsSchema } from '../types'

export type AccountSettingsService = ReturnType<typeof createAccountSettingsService>

export function createAccountSettingsService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:account-settings:service')

  function toSettingsLogSummary(accountSettings: AccountSettings) {
    return {
      llmModel: accountSettings.llm.model,
      embeddingModel: accountSettings.embedding.model,
      visionModel: accountSettings.visionLLM.model,
      hasLlmApiKey: toSafePresenceFlag(accountSettings.llm.apiKey),
      hasEmbeddingApiKey: toSafePresenceFlag(accountSettings.embedding.apiKey),
      hasVisionApiKey: toSafePresenceFlag(accountSettings.visionLLM.apiKey),
      enablePhotoEmbedding: !!accountSettings.messageProcessing.enablePhotoEmbedding,
      disabledResolversCount: accountSettings.messageProcessing.resolvers?.disabledResolvers?.length ?? 0,
    }
  }

  async function fetchAccountSettings(): Promise<AccountSettings> {
    logger.verbose('Fetching account settings')
    return ctx.getAccountSettings()
  }

  async function setAccountSettings(accountSettings: AccountSettings): Promise<AccountSettings> {
    logger.withFields(toSettingsLogSummary(accountSettings)).verbose('Setting account settings')

    const parsedAccountSettings = safeParse(accountSettingsSchema, accountSettings)
    // TODO: handle error
    if (!parsedAccountSettings.success) {
      throw new Error('Invalid config')
    }

    await ctx.setAccountSettings(parsedAccountSettings.output)
    return parsedAccountSettings.output
  }

  return {
    fetchAccountSettings,
    setAccountSettings,
  }
}
