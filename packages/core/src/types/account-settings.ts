import type { InferOutput } from 'valibot'

import { array, boolean, enum as enumType, number, object, optional, string } from 'valibot'

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
  batchSize: optional(number(), 10),
})

export const llmConfigSchema = object({
  model: optional(string(), 'gpt-4o-mini'),
  apiKey: optional(string(), ''),
  apiBase: optional(string(), 'https://api.openai.com/v1'),
  temperature: optional(number(), 0.7),
  maxTokens: optional(number(), 2000),
})

export const visionLLMConfigSchema = object({
  model: optional(string(), 'qwen-vl-max'),
  apiKey: optional(string(), ''),
  apiBase: optional(string(), ''),
  temperature: optional(number(), 0.7),
  maxTokens: optional(number(), 1024),
})

export const resolversConfigSchema = object({
  // Avatar resolver is disabled by default: client-driven, on-demand fetching
  disabledResolvers: optional(array(string()), ['avatar']),
})

export const receiveMessagesConfigSchema = object({
  receiveAll: optional(boolean(), true),
  downloadMedia: optional(boolean(), true),
})

export const syncOptionsSchema = object({
  syncMedia: optional(boolean(), true),
  maxMediaSize: optional(number(), 0),
  skipEmbedding: optional(boolean()),
  skipJieba: optional(boolean()),
})

export const messageProcessingSchema = object({
  receiveMessages: optional(receiveMessagesConfigSchema, {}),
  resolvers: optional(resolversConfigSchema, {}),
  defaults: optional(syncOptionsSchema, { syncMedia: true, maxMediaSize: 0 }),
  enablePhotoEmbedding: optional(boolean(), false),
})

export const botConfigSchema = object({
  enabled: optional(boolean(), false),
  token: optional(string()),
  notifyChatId: optional(string()),
  lastSearchChatId: optional(string()), // Remember last selected chat for search
})

export const accountSettingsSchema = object({
  embedding: optional(embeddingConfigSchema, {}),
  llm: optional(llmConfigSchema, {}),
  visionLLM: optional(visionLLMConfigSchema, {}),
  resolvers: optional(resolversConfigSchema, {}),
  receiveMessages: optional(receiveMessagesConfigSchema, {}),
  bot: optional(botConfigSchema, {}),
  messageProcessing: optional(messageProcessingSchema, {}),
})

export type EmbeddingConfig = InferOutput<typeof embeddingConfigSchema>
export type LLMConfig = InferOutput<typeof llmConfigSchema>
export type VisionLLMConfig = InferOutput<typeof visionLLMConfigSchema>
export type AccountSettings = InferOutput<typeof accountSettingsSchema>
