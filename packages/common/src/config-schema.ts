import type { InferOutput } from 'valibot'

import { boolean, enum as enumType, number, object, optional, string } from 'valibot'

export enum SocksType {
  SOCKS4 = 4,
  SOCKS5 = 5,
}

export enum EmbeddingProvider {
  OPENAI = 'openai',
  OLLAMA = 'ollama',
}

export enum EmbeddingDimension {
  DIMENSION_1536 = 1536,
  DIMENSION_1024 = 1024,
  DIMENSION_768 = 768,
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
  apiId: optional(string(), import.meta.env.VITE_TELEGRAM_APP_ID || ''),
  apiHash: optional(string(), import.meta.env.VITE_TELEGRAM_APP_HASH || ''),
  proxy: optional(proxyConfigSchema),
  receiveMessage: optional(boolean(), true),
})

export const embeddingConfigSchema = object({
  provider: optional(enumType(EmbeddingProvider), EmbeddingProvider.OPENAI),
  model: optional(string(), 'text-embedding-3-small'),
  dimension: optional(enumType(EmbeddingDimension), EmbeddingDimension.DIMENSION_1536),
  apiKey: optional(string(), ''),
  apiBase: optional(string(), ''),
})

export const apiConfigSchema = object({
  telegram: optional(telegramConfigSchema, {}),
  embedding: optional(embeddingConfigSchema, {}),
})

export const configSchema = object({
  database: optional(databaseConfigSchema, {}),
  api: optional(apiConfigSchema, {}),
})

export type Config = InferOutput<typeof configSchema>
export type ProxyConfig = InferOutput<typeof proxyConfigSchema>
