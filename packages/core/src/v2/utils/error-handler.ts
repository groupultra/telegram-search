import type { CoreEmitter } from '../context'

import { useLogger } from '@tg-search/common'

export function createErrorHandler(emitter: CoreEmitter) {
  const logger = useLogger()

  return (error: Error | string | unknown, message?: string) => {
    emitter.emit('core:error', { error })
    logger.withError(error).error(message || 'Error occurred')
    return error
  }
}
