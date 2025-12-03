import type { InferOutput } from 'valibot'

import { array, enum as enumType, number, object, optional, string } from 'valibot'

export enum EmbeddingDimension {
  DIMENSION_1536 = 1536,
  DIMENSION_1024 = 1024,
  DIMENSION_768 = 768,
}

export const embeddingConfigSchema = object({
  model: optional(string(), 'text-embedding-3-small'),
  dimension: optional(enumType(EmbeddingDimension), EmbeddingDimension.DIMENSION_1536),
  apiKey: optional(string(), ''),
  apiBase: optional(string(), ''),
})

export const llmConfigSchema = object({
  provider: optional(string(), 'openai'),
  model: optional(string(), 'gpt-4o-mini'),
  apiKey: optional(string(), ''),
  apiBase: optional(string(), 'https://api.openai.com/v1'),
  temperature: optional(number(), 0.7),
  maxTokens: optional(number(), 2000),
})

export const resolversConfigSchema = object({
  // Avatar resolver is disabled by default: client-driven, on-demand fetching
  disabledResolvers: optional(array(string()), ['avatar']),
})

export const accountSettingsSchema = object({
  embedding: optional(embeddingConfigSchema, {}),
  llm: optional(llmConfigSchema, {}),
  resolvers: optional(resolversConfigSchema, {}),
})

export type EmbeddingConfig = InferOutput<typeof embeddingConfigSchema>
export type AccountSettings = InferOutput<typeof accountSettingsSchema>
