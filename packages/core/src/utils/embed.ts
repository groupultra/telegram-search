import type { Result } from '@unbird/result'
import type { EmbedManyResult } from '@xsai/embed'

import type { EmbeddingConfig } from '../types/account-settings'

import { Err, Ok } from '@unbird/result'
import { embedMany } from '@xsai/embed'

export async function embedContents(
  contents: string[],
  embeddingConfig: EmbeddingConfig,
): Promise<Result<EmbedManyResult & { dimension: number }>> {
  try {
    const embeddings = await embedMany({
      apiKey: embeddingConfig.apiKey,
      baseURL: embeddingConfig.apiBase || '',
      input: contents,
      model: embeddingConfig.model,
      /**
       * The number of dimensions the resulting output embeddings should have.
       *
       * Not every model from every providers supports this parameter, currently
       * known: OpenAI, Voyage AI.
       *
       * @see {@link https://platform.openai.com/docs/api-reference/embeddings/object}
       */
      dimension: embeddingConfig.dimension,
    })

    if (embeddings.embeddings.length > 0) {
      const outputDimension = embeddings.embeddings[0].length
      if (outputDimension !== embeddingConfig.dimension) {
        return Err(`Output dimension ${outputDimension} does not match expected dimension ${embeddingConfig.dimension}`)
      }
    }

    return Ok({
      ...embeddings,
      dimension: embeddingConfig.dimension,
    })
  }
  catch (err) {
    return Err(err)
  }
}
