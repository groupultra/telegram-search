import { normalizeRemoteUrl } from '@tg-search/protocol'
import { array, minLength, nonEmpty, optional, parse, picklist, pipe, regex, string, transform } from 'valibot'

export type AuthConfig
  = | { mode: 'none' }
    | {
      mode: 'oauth'
      /** Canonical origin without a trailing slash; issuer and resource identifiers derive from it. */
      publicUrl: string
      secret: string
      /** Telegram user IDs that may grant the `database:admin` scope. */
      adminTelegramIds: ReadonlySet<string>
    }

const telegramId = pipe(string(), regex(/^\d{1,20}$/, 'Telegram IDs are decimal numbers'))

const adminTelegramIdsSchema = pipe(
  optional(string(), ''),
  transform(value => value.split(',').map(item => item.trim()).filter(Boolean)),
  array(telegramId),
)

const removedVariables = ['TG_SEARCH_REMOTE_ACCESS', 'TG_SEARCH_REMOTE_TOKEN'] as const

/**
 * Reads the authorization mode. `none` keeps the single-user server without
 * remote API or MCP; `oauth` requires every variable and refuses partial setups.
 */
export function authConfigFromEnv(env: Record<string, string | undefined>): AuthConfig {
  for (const name of removedVariables) {
    // Static bearer credentials were replaced by OAuth; starting without them would silently drop the operator's access policy.
    if (env[name] !== undefined)
      throw new Error(`${name} is no longer supported; configure OAuth with TGS_AUTH=oauth (see apps/server/README.md)`)
  }

  const mode = parse(picklist(['none', 'oauth'], 'TGS_AUTH must be "none" or "oauth"'), env.TGS_AUTH || 'none')
  if (mode === 'none')
    return { mode }

  const required = (name: string) => parse(pipe(string(`${name} is required when TGS_AUTH=oauth`), nonEmpty(`${name} is required when TGS_AUTH=oauth`)), env[name])
  let publicUrl: string
  try {
    publicUrl = normalizeRemoteUrl(required('TGS_PUBLIC_URL'))
  }
  catch (error) {
    throw new Error(`TGS_PUBLIC_URL is invalid: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
  if (new URL(publicUrl).pathname !== '/')
    throw new Error('TGS_PUBLIC_URL must be an origin without a path')

  return {
    mode,
    publicUrl,
    secret: parse(pipe(string(), minLength(32, 'BETTER_AUTH_SECRET must contain at least 32 characters')), required('BETTER_AUTH_SECRET')),
    adminTelegramIds: new Set(parse(adminTelegramIdsSchema, env.TGS_ADMIN_TELEGRAM_IDS)),
  }
}
