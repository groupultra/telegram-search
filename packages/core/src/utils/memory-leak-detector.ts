import type { Logger } from '@guiiai/logg'

import type { CoreEmitter } from '../context'

/**
 * Detect memory leaks in development mode
 * Returns a cleanup function to clear the interval
 */
export function detectMemoryLeak(emitter: CoreEmitter, logger: Logger): () => void {
  logger = logger.withContext('core:memory-leak')

  // Memory leak detection in development mode
  // eslint-disable-next-line node/prefer-global/process
  const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'

  let checkInterval: NodeJS.Timeout | undefined

  if (isDevelopment) {
    checkInterval = setInterval(() => {
      const raw = emitter.raw
      const listenerCounts: Record<string, number> = {}

      // Count listeners from the Eventa context's internal maps
      for (const [eventId, listeners] of raw.listeners) {
        if (listeners.size > 0) {
          listenerCounts[eventId] = (listenerCounts[eventId] || 0) + listeners.size
        }
      }
      for (const [eventId, listeners] of raw.onceListeners) {
        if (listeners.size > 0) {
          listenerCounts[eventId] = (listenerCounts[eventId] || 0) + listeners.size
        }
      }

      const totalListeners = Object.values(listenerCounts).reduce((sum, count) => sum + count, 0)

      if (totalListeners > 100) {
        logger.withFields({
          totalListeners,
          listenerCounts,
        }).warn('High number of event listeners detected - potential memory leak')
      }
      else {
        logger.withFields({
          totalListeners,
          listenerCounts,
        }).debug('Event listener count check')
      }
    }, 60000) // Check every minute
  }

  // Return cleanup function
  return () => {
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = undefined
    }
  }
}
