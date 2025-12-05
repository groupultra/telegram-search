import type { InferOutput } from 'valibot'

import { boolean, enum as enumType, number, object, optional, safeParse, string } from 'valibot'

export enum SocksType {
  SOCKS4 = 4,
  SOCKS5 = 5,
}

export enum DatabaseType {
  POSTGRES = 'postgres',
  PGLITE = 'pglite',
}

export const proxyConfigSchema = object({
  MTProxy: optional(boolean()),

  /**
   * Proxy URL for convenient configuration, takes precedence over individual fields
   */
  proxyUrl: optional(string()),

  /**
   * @deprecated Use proxyUrl instead
   */
  ip: optional(string(), ''),
  /**
   * @deprecated Use proxyUrl instead
   */
  port: optional(number(), 0),
  /**
   * @deprecated Use proxyUrl instead
   */
  secret: optional(string()),
  /**
   * @deprecated Use proxyUrl instead
   */
  socksType: optional(enumType(SocksType)),
  /**
   * @deprecated Use proxyUrl instead
   */
  timeout: optional(number()),
  /**
   * @deprecated Use proxyUrl instead
   */
  username: optional(string()),
  /**
   * @deprecated Use proxyUrl instead
   */
  password: optional(string()),
})

export const databaseConfigSchema = object({
  type: optional(enumType(DatabaseType), DatabaseType.PGLITE),
  host: optional(string()),
  port: optional(number()),
  user: optional(string()),
  password: optional(string()),
  database: optional(string()),
  url: optional(string()),
})

export const telegramConfigSchema = object({
  apiId: optional(string()),
  apiHash: optional(string()),
  proxy: optional(proxyConfigSchema),
})

export const apiConfigSchema = object({
  telegram: optional(telegramConfigSchema, {}),
})

export const configSchema = object({
  database: optional(databaseConfigSchema, {}),
  api: optional(apiConfigSchema, {}),
})

export type Config = InferOutput<typeof configSchema>
export type ProxyConfig = InferOutput<typeof proxyConfigSchema>
export type DatabaseConfig = InferOutput<typeof databaseConfigSchema>

export function generateDefaultConfig(): Config {
  const defaultConfig = safeParse(configSchema, {})

  if (!defaultConfig.success) {
    throw new Error('Failed to generate default config', { cause: defaultConfig.issues })
  }

  return defaultConfig.output
}
