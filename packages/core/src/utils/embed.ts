import type { EmbedManyResult } from '@xsai/embed'

import { EmbeddingProvider, useConfig } from '@tg-search/common'
import { Ok } from '@unbird/result'
import { createOllama } from '@xsai-ext/providers-local'
import { embedMany } from '@xsai/embed'

export async function embedContents(contents: string[]) {
  const embeddingConfig = useConfig().api.embedding

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
