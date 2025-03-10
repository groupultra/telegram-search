import type { EmbeddingTableConfig } from '@tg-search/db'
import type { EmbeddingModelConfig } from '../types'

import { getConfig, useLogger } from '@tg-search/common'

import { EmbeddingAdapter } from '../adapter/embedding/adapter'
/**
 * Service for generating embeddings from text
 */
export class EmbeddingService {
  private embedding: EmbeddingAdapter
  private embedding_config: EmbeddingTableConfig
  private logger = useLogger()
  private config = getConfig()

  constructor() {
    this.embedding = new EmbeddingAdapter({
      ...this.config.api.embedding,
    } as EmbeddingModelConfig)
    this.embedding_config = {
      ...this.config.api.embedding,
      dimensions: this.config.api.embedding.dimensions,
    } as EmbeddingTableConfig
  }

  /**
   * 获取模型配置
   */
  getEmbeddingConfig(): EmbeddingTableConfig {
    return this.embedding_config
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
