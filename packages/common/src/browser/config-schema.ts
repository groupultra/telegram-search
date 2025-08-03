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
  type: optional(enumType(DatabaseType), DatabaseType.POSTGRES),
  host: optional(string(), 'localhost'),
  port: optional(number(), 5432),
  user: optional(string(), 'postgres'),
  password: optional(string(), 'postgres'),
  database: optional(string(), 'postgres'),
  url: optional(string()),
})

export const pathConfigSchema = object({
  storage: optional(string(), '.cache'),
  dict: optional(string(), ''),
  assets: optional(string(), ''),
})

export const telegramConfigSchema = object({
  apiId: optional(string(), ''),
  apiHash: optional(string(), ''),
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
  path: optional(pathConfigSchema, {}),
  api: optional(apiConfigSchema, {}),
})

export type Config = InferOutput<typeof configSchema>
export type ProxyConfig = InferOutput<typeof proxyConfigSchema>
