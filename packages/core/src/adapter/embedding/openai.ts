import type { Tiktoken, TiktokenModel } from 'tiktoken'
import type { EmbeddingModelConfig, IEmbeddingModel } from './../../types/adapter'

import { useLogger } from '@tg-search/common'
import { createOpenAI } from '@xsai-ext/providers-cloud'
import { embed, embedMany } from '@xsai/embed'
import { encoding_for_model } from 'tiktoken'
// OpenAI API 限制和定价
const LIMITS = {
  // text-embedding-3-small 的最大 token 限制
  MAX_TOKENS_PER_REQUEST: 8191,
  // 建议的单个文本最大 token
  MAX_TOKENS_PER_TEXT: 4000,
  // 每 1K tokens 的价格（美元）
  PRICE_PER_1K_TOKENS: 0.00002,
}
export class EmbeddingModelOpenai implements IEmbeddingModel {
  private config: EmbeddingModelConfig
  private logger = useLogger()
  private embedding
  private encoder: Tiktoken
  private totalTokens = 0
  private totalCost = 0
  constructor(config: EmbeddingModelConfig) {
    this.config = config
    this.encoder = encoding_for_model(this.config.model as TiktokenModel)
    this.embedding = createOpenAI(this.config.apiKey || '', this.config.apiBase || 'https://api.openai.com/v1')
  }

  getTokenCount(text: string) {
    return this.encoder.encode(text).length
  }

  getTotalTokens(texts: string[]) {
    return texts.reduce((sum, text) => sum + this.getTokenCount(text), 0)
  }

  calculateCost(tokens: number) {
    return (tokens / 1000) * LIMITS.PRICE_PER_1K_TOKENS
  }

  getUsage() {
    return {
      tokens: this.totalTokens,
      cost: this.totalCost,
    }
  }

  async generateEmbedding(text: string) {
    try {
      const tokenCount = this.getTokenCount(text)
      if (tokenCount > LIMITS.MAX_TOKENS_PER_TEXT) {
        this.logger.warn(`文本 token 数量(${tokenCount})超过建议值(${LIMITS.MAX_TOKENS_PER_TEXT})，可能会被截断`)
      }
      const { embedding } = await embed({
        ...this.embedding.embed(this.config.model),
        input: text,
      })

      // 更新使用统计
      this.totalTokens += tokenCount
      this.totalCost += this.calculateCost(tokenCount)

      return embedding
    }
    catch (error) {
      this.logger.withError(error).error('生成向量嵌入失败')
      throw error
    }
  }

  async generateEmbeddings(texts: string[]) {
    try {
      const totalTokens = this.getTotalTokens(texts)
      if (totalTokens > LIMITS.MAX_TOKENS_PER_REQUEST) {
        throw new Error(`批次总 token 数量(${totalTokens})超过 API 限制(${LIMITS.MAX_TOKENS_PER_REQUEST})`)
      }
      const longTexts = texts.filter(text => this.getTokenCount(text) > LIMITS.MAX_TOKENS_PER_TEXT)
      if (longTexts.length > 0) {
        this.logger.warn(`${longTexts.length} 条文本的 token 数量超过建议值(${LIMITS.MAX_TOKENS_PER_TEXT})，可能会被截断`)
      }
      const { embeddings } = await embedMany({
        ...this.embedding.embed(this.config.model),
        input: texts,
      })
      this.totalTokens += totalTokens
      this.totalCost += this.calculateCost(totalTokens)
      return embeddings
    }
    catch (error) {
      this.logger.withError(error).error('批量生成向量嵌入失败')
      throw error
    }
  }

  destroy() {
    this.encoder.free()
  }
}
