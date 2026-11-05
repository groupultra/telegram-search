// NOTICE: Telegram Search's own application credentials, shared with
// `.env.example`. They let users log in without registering an app on
// my.telegram.org; configuration and environment variables can still override them.
export const BUILTIN_TELEGRAM_API_ID = '611335'
export const BUILTIN_TELEGRAM_API_HASH = 'd524b414d21f4d37f08684c1df41ac9c'

export interface TelegramCredentialCandidate<Source extends string> {
  apiId?: string
  apiHash?: string
  source: Source
}

export interface TelegramCredentials<Source extends string> {
  apiId: string
  apiHash: string
  source: Source | 'builtin'
}

function filled(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0
}

/**
 * Pick the first complete API ID/hash pair, falling back to the built-in app.
 * An API hash only works with the API ID it was issued for, so fields are never
 * mixed across candidates and an incomplete pair is skipped.
 */
export function resolveTelegramCredentials<Source extends string>(
  candidates: TelegramCredentialCandidate<Source>[],
): TelegramCredentials<Source> {
  for (const { apiId, apiHash, source } of candidates) {
    if (filled(apiId) && filled(apiHash))
      return { apiId, apiHash, source }
  }
  return { apiId: BUILTIN_TELEGRAM_API_ID, apiHash: BUILTIN_TELEGRAM_API_HASH, source: 'builtin' }
}
