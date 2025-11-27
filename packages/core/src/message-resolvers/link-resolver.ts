import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreMessage } from '../types/message'

import { useLogger } from '@guiiai/logg'
import { Ok } from '@unbird/result'

export function createLinkResolver(): MessageResolver {
  const logger = useLogger('core:resolver:link')

  return {
    run: async (_opts: MessageResolverOpts) => {
      logger.verbose('Executing link resolver')

      return Ok([] as CoreMessage[])
    },
  }
}
