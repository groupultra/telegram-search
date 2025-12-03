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
    })

    return Ok({
      ...embeddings,
      dimension: embeddingConfig.dimension,
    })
  }
  catch (err) {
    return Err(err)
  }
}
