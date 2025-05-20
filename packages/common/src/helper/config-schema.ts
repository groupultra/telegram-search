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
  SQLITE_VEC = 'sqlite_vec',
}

export const proxyConfigSchema = object({
  ip: string(),
  port: number(),
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

export const messageConfigSchema = object({
  export: object({
    batchSize: optional(number(), 200),
    concurrent: optional(number(), 3),
    retryTimes: optional(number(), 3),
    maxTakeoutRetries: optional(number(), 3),
  }),
  batch: object({
    size: optional(number(), 100),
  }),
})

export const pathConfigSchema = object({
  storage: string(),
  dict: string(),
  assets: optional(string(), ''),
})

export const telegramConfigSchema = object({
  apiId: string(),
  apiHash: string(),
  phoneNumber: string(),
  proxy: optional(proxyConfigSchema),
})

export const embeddingConfigSchema = object({
  provider: optional(enumType(EmbeddingProvider), EmbeddingProvider.OPENAI),
  model: optional(string(), 'text-embedding-3-small'),
  dimension: optional(enumType(EmbeddingDimension), EmbeddingDimension.DIMENSION_1536),
  apiKey: optional(string(), ''),
  apiBase: optional(string(), ''),
})

export const apiConfigSchema = object({
  telegram: telegramConfigSchema,
  embedding: embeddingConfigSchema,
})

export const configSchema = object({
  database: databaseConfigSchema,
  message: messageConfigSchema,
  path: pathConfigSchema,
  api: apiConfigSchema,
})

export type Config = InferOutput<typeof configSchema>
export type ProxyConfig = InferOutput<typeof proxyConfigSchema>
