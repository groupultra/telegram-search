import type { CoreEmitter } from '../context'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'
import { FloodWaitError } from 'telegram/errors'

export function createErrorHandler(emitter: CoreEmitter) {
  const logger = useLogger()

  return (error: Error | string | unknown, message?: string) => {
    if (error instanceof FloodWaitError) {
      logger.withFields({ seconds: error.seconds }).warn('Flood wait')
    }
    else if (error instanceof Api.RpcError) {
      emitter.emit('core:error', { error })
      logger.withFields({ error: error.errorMessage }).error('RPC error')
    }
    else {
      emitter.emit('core:error', { error })
      logger.withError(error).error(message || 'Error occurred')
    }

    return error
  }
}
