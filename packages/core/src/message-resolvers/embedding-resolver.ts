import type { Logger } from '@guiiai/logg'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { ProcessedCoreMessage } from '../types/message'

import { Ok } from '@unbird/result'

import { EmbeddingDimension } from '../types/account-settings'
import { embedContents } from '../utils/embed'

export function createEmbeddingResolver(ctx: CoreContext, logger: Logger): MessageResolver {
  logger = logger.withContext('core:resolver:embedding')

  return {
    run: async (opts: MessageResolverOpts) => {
      // TODO: should we store the account settings into ctx, to avoid fetching it from db every time?
      const embeddingSettings = (await ctx.getAccountSettings()).embedding
      logger.withFields({ embeddingSettings }).verbose('Executing embedding resolver')

      // Skip embedding if API key is empty
      if ((!embeddingSettings.apiKey || embeddingSettings.apiKey.trim() === '')) {
        logger.debug('skipping embedding: API key is empty')
        return Ok([])
      }

      const messages: ProcessedCoreMessage[] = opts.messages.filter(message => message.content)

      if (messages.length === 0)
        return Ok([])

      logger.withFields({ count: messages.length }).verbose('Embedding messages')
      const batchSize = embeddingSettings.batchSize

      // Split messages into batches
      const allEmbeddings: number[][] = []
      const totalUsage = { prompt_tokens: 0, total_tokens: 0 }
      let dimension: number | undefined

      for (let i = 0; i < messages.length; i += batchSize) {
        const batchMessages = messages.slice(i, i + batchSize)
        const batchContents = batchMessages.map(message => message.content)

        logger.withFields({
          batch: Math.floor(i / batchSize) + 1,
          batchSize: batchMessages.length,
          totalBatches: Math.ceil(messages.length / batchSize),
        }).verbose('Processing embedding batch')

        const result = (await embedContents(batchContents, embeddingSettings)).expect('Failed to embed messages')

        allEmbeddings.push(...result.embeddings)
        totalUsage.prompt_tokens += result.usage.prompt_tokens
        totalUsage.total_tokens += result.usage.total_tokens
        dimension = result.dimension
      }

      logger.withFields({ count: allEmbeddings.length, usage: totalUsage }).verbose('Embedding messages done')

      if (!dimension) {
        throw new Error('No dimension returned from embedding')
      }

      for (const [index, message] of messages.entries()) {
        message.vectors = {
          model: embeddingSettings.model,
          vector1536: [],
          vector1024: [],
          vector768: [],
        }

        switch (dimension) {
          case EmbeddingDimension.DIMENSION_1536:
            message.vectors.vector1536 = allEmbeddings[index]
            break
          case EmbeddingDimension.DIMENSION_1024:
            message.vectors.vector1024 = allEmbeddings[index]
            break
          case EmbeddingDimension.DIMENSION_768:
            message.vectors.vector768 = allEmbeddings[index]
            break
          default:
            throw new Error(`Unsupported embedding dimension: ${dimension}`)
        }
      }

      return Ok(messages)
    },
  }
}
