import type { Resolver } from '../registry'

import { useLogger } from '@tg-search/common'

interface LinkResolverOpts {
  text: string
}

export function createLinkResolver(): Resolver<LinkResolverOpts> {
  const logger = useLogger()

  return {
    run: async (opts: LinkResolverOpts) => {
      logger.debug('Link resolver', opts)
    },
  }
}
