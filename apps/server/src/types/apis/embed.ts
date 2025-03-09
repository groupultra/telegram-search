/**
 * Embed command parameters
 */
export interface EmbedParams {
  chatId: number
  batchSize?: number
  concurrency?: number
  [key: string]: any
}

/**
 * Embed command details
 */
export interface EmbedDetails extends Record<string, unknown> {
  totalMessages: number
  processedMessages: number
  failedMessages: number
  currentBatch: number
  totalBatches: number
  error?: {
    name: string
    message: string
    stack?: string
  } | string
}
