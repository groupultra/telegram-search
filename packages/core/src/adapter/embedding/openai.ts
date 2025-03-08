import type { Tiktoken, TiktokenModel } from 'tiktoken'
import type { EmbeddingModelConfig, IEmbeddingModel } from './../../types/adapter'

import { useLogger } from '@tg-search/common'
import { createOpenAI } from '@xsai-ext/providers-cloud'
import { embed, embedMany } from '@xsai/embed'
import { encoding_for_model } from 'tiktoken'

import { ErrorHandler } from '../client/utils/error-handler'

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
  private errorHandler = new ErrorHandler()
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
    const result = await this.errorHandler.withRetry(
      async () => {
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
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        context: '生成向量嵌入',
        errorMessage: '生成向量嵌入失败',
      },
    )

    if (!result.success || !result.data) {
      throw result.error || new Error('生成向量嵌入失败')
    }
    return result.data
  }

  async generateEmbeddings(texts: string[]) {
    try {
      // 将文本分成多个批次处理
      const batches: string[][] = []
      let currentBatch: string[] = []
      let currentBatchTokens = 0

      for (const text of texts) {
        const textTokens = this.getTokenCount(text)
        if (currentBatchTokens + textTokens > LIMITS.MAX_TOKENS_PER_REQUEST) {
          // 当前批次已满，创建新批次
          if (currentBatch.length > 0) {
            batches.push(currentBatch)
          }
          currentBatch = [text]
          currentBatchTokens = textTokens
        }
        else {
          currentBatch.push(text)
          currentBatchTokens += textTokens
        }
      }

      // 添加最后一个批次
      if (currentBatch.length > 0) {
        batches.push(currentBatch)
      }

      // 处理每个批次并合并结果
      const allEmbeddings: number[][] = []
      for (const batch of batches) {
        const result = await this.errorHandler.withRetry(
          async () => {
            const longTexts = batch.filter(text => this.getTokenCount(text) > LIMITS.MAX_TOKENS_PER_TEXT)
            if (longTexts.length > 0) {
              this.logger.warn(`${longTexts.length} 条文本的 token 数量超过建议值(${LIMITS.MAX_TOKENS_PER_TEXT})，可能会被截断`)
            }

            const { embeddings } = await embedMany({
              ...this.embedding.embed(this.config.model),
              input: batch,
            })

            const batchTokens = this.getTotalTokens(batch)
            this.totalTokens += batchTokens
            this.totalCost += this.calculateCost(batchTokens)

            return embeddings
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            context: '批量生成向量嵌入',
            errorMessage: '批量生成向量嵌入失败',
          },
        )

        if (!result.success || !result.data) {
          throw result.error || new Error('批量生成向量嵌入失败')
        }

        allEmbeddings.push(...result.data)
      }

      return allEmbeddings
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
