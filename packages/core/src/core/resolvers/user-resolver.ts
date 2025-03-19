import type { Resolver } from '../registry'

import { useLogger } from '@tg-search/common'

interface UserResolverOpts {
  text: string
}

export function createUserResolver(): Resolver<UserResolverOpts> {
  const logger = useLogger()

  return {
    run: async (opts: UserResolverOpts) => {
      logger.debug('User resolver', opts)
    },
  }
}
