import type { EmbeddingModelConfig } from '../types'

import { getConfig, useLogger } from '@tg-search/common'

import { EmbeddingAdapter } from '../adapter/embedding/adapter'
/**
 * Service for generating embeddings from text
 */
export class EmbeddingService {
  private embedding
  private logger = useLogger()
  private config = getConfig()

  constructor() {
    this.embedding = new EmbeddingAdapter({
      ...this.config.api.embedding,
    } as EmbeddingModelConfig)
  }

  /**
   * Get total usage statistics
   */
  getUsage(): { tokens: number, cost: number } {
    return this.embedding.getUsage()
  }

  /**
   * Generate embedding for a text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return await this.embedding.generateEmbedding(text)
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return await this.embedding.generateEmbeddings(texts)
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.embedding.destroy()
  }
}
