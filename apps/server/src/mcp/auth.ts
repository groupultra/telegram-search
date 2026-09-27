import type { JWTVerifyGetKey } from 'jose'

import { accountIdSchema, normalizeRemoteUrl } from '@tg-search/protocol'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { parse } from 'valibot'

export const MCP_SCOPE = 'telegram:read'

export interface McpConfig {
  resource: string
  issuer: string
  jwksUrl: string
  subject: string
  accountId: string
  webUrl: string
}

export function mcpConfigFromEnv(env: Record<string, string | undefined>): McpConfig | undefined {
  const names = ['RESOURCE_URL', 'ISSUER', 'JWKS_URL', 'SUBJECT', 'ACCOUNT_ID', 'WEB_URL'] as const
  if (names.every(name => env[`TG_SEARCH_MCP_${name}`] === undefined))
    return undefined
  function required(name: typeof names[number]): string {
    const value = env[`TG_SEARCH_MCP_${name}`]
    if (!value)
      throw new Error(`TG_SEARCH_MCP_${name} is required when MCP is enabled`)
    return value
  }
  const resource = normalizeRemoteUrl(required('RESOURCE_URL'))
  if (new URL(resource).pathname !== '/mcp')
    throw new Error('TG_SEARCH_MCP_RESOURCE_URL must have path /mcp')
  const issuer = required('ISSUER')
  normalizeRemoteUrl(issuer)
  const accountId = parse(accountIdSchema, required('ACCOUNT_ID'))
  return {
    resource,
    issuer,
    jwksUrl: normalizeRemoteUrl(required('JWKS_URL')),
    subject: required('SUBJECT'),
    accountId,
    webUrl: normalizeRemoteUrl(required('WEB_URL')),
  }
}

export function createMcpTokenVerifier(config: McpConfig, getKey: JWTVerifyGetKey = createRemoteJWKSet(new URL(config.jwksUrl))) {
  return async (token: string): Promise<string> => {
    const { payload } = await jwtVerify(token, getKey, {
      issuer: config.issuer,
      audience: config.resource,
      subject: config.subject,
      algorithms: ['RS256', 'ES256'],
      requiredClaims: ['exp', 'sub', 'aud', 'iss'],
    })
    if (typeof payload.scope !== 'string' || !payload.scope.split(' ').includes(MCP_SCOPE))
      throw new Error('Missing Telegram read scope')
    return config.accountId
  }
}
