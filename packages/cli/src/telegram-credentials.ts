import type { ProfileConfig } from './profile'

import process from 'node:process'

import { resolveTelegramCredentials } from '@tg-search/common'

/** Profile config wins, then `TELEGRAM_API_ID`/`TELEGRAM_API_HASH`, then the built-in app. */
export function resolveCliTelegramCredentials(
  config: Pick<ProfileConfig, 'apiId' | 'apiHash'>,
  environment: Record<string, string | undefined> = process.env,
) {
  return resolveTelegramCredentials([
    { apiId: config.apiId, apiHash: config.apiHash, source: 'profile' as const },
    { apiId: environment.TELEGRAM_API_ID, apiHash: environment.TELEGRAM_API_HASH, source: 'environment' as const },
  ])
}
