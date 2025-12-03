import type { Result } from '@unbird/result'
import type { EmbedManyResult } from '@xsai/embed'

import type { EmbeddingConfig } from '../types/account-settings'

import { Err, Ok } from '@unbird/result'
import { createOllama } from '@xsai-ext/providers-local'
import { embedMany } from '@xsai/embed'

import { EmbeddingProvider } from '../types/account-settings'

export async function embedContents(
  contents: string[],
  embeddingConfig: EmbeddingConfig,
): Promise<Result<EmbedManyResult & { dimension: number }>> {
  try {
    let embeddings: EmbedManyResult
    switch (embeddingConfig.provider) {
      case EmbeddingProvider.OPENAI:
        embeddings = await embedMany({
          apiKey: embeddingConfig.apiKey,
          baseURL: embeddingConfig.apiBase || '',
          input: contents,
          model: embeddingConfig.model,
        })
        break
      case EmbeddingProvider.OLLAMA:
        embeddings = await embedMany({
          ...createOllama(embeddingConfig.apiBase).chat(embeddingConfig.model),
          input: contents,
        })
        break
      default:
        throw new Error(`Unsupported embedding model: ${embeddingConfig.provider}`)
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
