import type { Resolver } from '../registry'

import { useLogger } from '@tg-search/common'

interface EmbeddingResolverOpts {
  text: string
}

export function createEmbeddingResolver(): Resolver<EmbeddingResolverOpts> {
  const logger = useLogger()

  return {
    run: async (opts: EmbeddingResolverOpts) => {
      logger.debug('Embedding resolver', opts)
    },
  }
}
