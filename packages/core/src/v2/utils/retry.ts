import { useLogger } from '@tg-search/common'

export function withRetry<T>(fn: () => Promise<T>, options: {
  maxRetries?: number
  initialDelay?: number
} = {}): Promise<T> {
  const logger = useLogger()

  const maxRetries = options.maxRetries || 1
  const initialDelay = options.initialDelay || 1000

  let retries = 0

  function attempt(): Promise<T> {
    return fn().catch((error) => {
      if (retries >= maxRetries) {
        logger.error('Max retries reached')
        throw error
      }

      const delay = initialDelay * 2 ** retries
      const jitter = Math.random() * 200
      const totalDelay = delay + jitter

      retries++
      logger.withFields({ retries, maxRetries, delay, jitter, totalDelay, fn: fn.name }).debug('Retry attempt')

      return new Promise(resolve =>
        setTimeout(() => resolve(attempt()), totalDelay),
      )
    })
  }

  return attempt()
}
