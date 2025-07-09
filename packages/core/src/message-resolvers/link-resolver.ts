import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreMessage } from '../utils/message'

import { useLogger } from '@tg-search/common'
import { Ok } from '@tg-search/result'

export function createLinkResolver(): MessageResolver {
  const logger = useLogger('core:resolver:link')

  return {
    run: async (_opts: MessageResolverOpts) => {
      logger.verbose('Executing link resolver')

      return Ok([] as CoreMessage[])
    },
  }
}
