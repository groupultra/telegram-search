import type { InferOutput } from 'valibot'

import { boolean, enum as enumType, number, object, optional, string } from 'valibot'

enum SocksType {
  SOCKS4 = 4,
  SOCKS5 = 5,
}

enum EmbeddingProvider {
  OPENAI = 'openai',
  OLLAMA = 'ollama',
}

export const coreConfigSchema = object({
  database: object({
    host: string(),
    port: number(),
    user: string(),
    password: string(),
    database: string(),
    url: optional(string()),
  }),
  message: object({
    export: object({
      batchSize: number(),
      concurrent: number(),
      retryTimes: number(),
      maxTakeoutRetries: number(),
    }),
    batch: object({
      size: number(),
    }),
  }),
  path: object({
    storage: string(),
  }),
  api: object({
    telegram: object({
      apiId: string(),
      apiHash: string(),
      phoneNumber: string(),
      proxy: optional(object({
        ip: string(),
        port: number(),
        MTProxy: optional(boolean()),
        secret: optional(string()),
        socksType: optional(enumType(SocksType)),
        timeout: optional(number()),
        username: optional(string()),
        password: optional(string()),
      })),
    }),
    embedding: object({
      provider: enumType(EmbeddingProvider),
      model: string(),
      apiKey: optional(string()),
      apiBase: optional(string()),
    }),
  }),
})

export type CoreConfig = InferOutput<typeof coreConfigSchema>
export type ClientProxyConfig = CoreConfig['api']['telegram']['proxy']
