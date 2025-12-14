import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { ProcessedCoreMessage } from '../types/message'

import { useLogger } from '@guiiai/logg'
import { Err, Ok } from '@unbird/result'

import { EmbeddingDimension } from '../types/account-settings'
import { embedContents } from '../utils/embed'

export function createEmbeddingResolver(ctx: CoreContext): MessageResolver {
  const logger = useLogger('core:resolver:embedding')

  return {
    run: async (opts: MessageResolverOpts) => {
      // TODO: should we store the account settings into ctx, to avoid fetching it from db every time?
      const embeddingSettings = (await ctx.getAccountSettings()).embedding
      logger.withFields({ embedding_settings: embeddingSettings }).verbose('Executing embedding resolver')

      // Skip embedding if API key is empty
      if (!embeddingSettings.apiKey || embeddingSettings.apiKey.trim() === '') {
        logger.verbose('Skipping embedding: API key is empty')
        return Ok([])
      }

      if (opts.messages.length === 0)
        return Err('No messages')

      const messages: ProcessedCoreMessage[] = opts.messages.filter(message => message.content)

      if (messages.length === 0)
        return Err('No messages to embed')

      logger.withFields({ count: messages.length }).verbose('Embedding messages')

      const { embeddings, usage, dimension } = (await embedContents(messages.map(message => message.content), embeddingSettings)).expect('Failed to embed messages')

      logger.withFields({ count: embeddings.length, usage }).verbose('Embedding messages done')

      for (const [index, message] of messages.entries()) {
        message.vectors = {
          vector1536: [],
          vector1024: [],
          vector768: [],
        }

        switch (dimension) {
          case EmbeddingDimension.DIMENSION_1536:
            message.vectors.vector1536 = embeddings[index]
            break
          case EmbeddingDimension.DIMENSION_1024:
            message.vectors.vector1024 = embeddings[index]
            break
          case EmbeddingDimension.DIMENSION_768:
            message.vectors.vector768 = embeddings[index]
            break
          default:
            throw new Error(`Unsupported embedding dimension: ${dimension}`)
        }
      }

      return Ok(messages)
    },
  }
}
