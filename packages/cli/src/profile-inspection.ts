import type { ProfilePaths } from './profile'

import process from 'node:process'

import { readProfileConfig, readSession } from './profile'

type ConfigurationSource = 'profile' | 'environment' | 'argument' | 'missing'

function presence(profile: string | undefined, environment: string | undefined): { present: boolean, source: ConfigurationSource } {
  if (profile !== undefined)
    return { present: profile.trim().length > 0, source: 'profile' }
  if (environment !== undefined)
    return { present: environment.trim().length > 0, source: 'environment' }
  return { present: false, source: 'missing' }
}

/** Configuration-only inspection: never authenticates, connects, or echoes values. */
export async function inspectProfile(paths: ProfilePaths, environment: Record<string, string | undefined> = process.env, remoteArgument?: string) {
  const [config, savedSession] = await Promise.all([readProfileConfig(paths), readSession(paths)])
  const apiId = presence(config.apiId, environment.TELEGRAM_API_ID)
  const apiHash = presence(config.apiHash, environment.TELEGRAM_API_HASH)
  const remoteToken = presence(undefined, environment.TG_SEARCH_REMOTE_TOKEN)
  const session = { present: savedSession.length > 0, source: savedSession.length > 0 ? 'profile' as const : 'missing' as const }
  const remoteUrl = remoteArgument !== undefined
    ? { present: remoteArgument.trim().length > 0, source: 'argument' as const }
    : environment.TG_SEARCH_REMOTE_URL !== undefined
      ? presence(undefined, environment.TG_SEARCH_REMOTE_URL)
      : presence(config.remoteUrl, undefined)
  const mode = remoteUrl.present ? 'remote' as const : 'local' as const
  const configured = { telegramRead: apiId.present && apiHash.present && session.present, remoteRead: remoteUrl.present && remoteToken.present }
  const findings: Array<{ code: string, action: string }> = []
  if (mode === 'remote') {
    if (!remoteToken.present)
      findings.push({ code: 'REMOTE_CREDENTIALS_MISSING', action: 'set_remote_token' })
  }
  else {
    if (!apiId.present || !apiHash.present)
      findings.push({ code: 'TELEGRAM_CREDENTIALS_MISSING', action: 'configure_profile' })
    if (!session.present)
      findings.push({ code: 'AUTH_REQUIRED', action: 'auth_login' })
  }
  return { mode, endpoint: remoteUrl, credentials: { apiId, apiHash, remoteToken, session }, configured, findings, verification: 'configuration-only' as const }
}
