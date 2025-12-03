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
  ip: optional(string(), ''),
  port: optional(number(), 0),
  MTProxy: optional(boolean()),
  secret: optional(string()),
  socksType: optional(enumType(SocksType)),
  timeout: optional(number()),
  username: optional(string()),
  password: optional(string()),
  // ProxyUrl for convenient configuration, takes precedence over individual fields
  proxyUrl: optional(string()),
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
