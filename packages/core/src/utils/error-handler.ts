import type { CoreEmitter } from '../context'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'
import { FloodWaitError } from 'telegram/errors'

export function createErrorHandler(emitter: CoreEmitter) {
  const logger = useLogger()

  return (error: unknown, description?: string): Error => {
    if (error instanceof FloodWaitError) {
      logger.withFields({ seconds: error.seconds }).warn('Flood wait')

      return error
    }
    else if (error instanceof Api.RpcError) {
      emitter.emit('core:error', { error })
      logger.withFields({ error: error.errorMessage }).error('RPC error')

      return new Error(error.errorMessage)
    }
    else {
      emitter.emit('core:error', { error })
      logger.withError(error).error(description || 'Error occurred')

      return new Error(description || 'Error occurred')
    }
  }
}
