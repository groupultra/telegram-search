import type { CoreEmitter } from '../context'

import { useLogger } from '@guiiai/logg'

/**
 * Detect memory leaks in development mode
 * Returns a cleanup function to clear the interval
 */
export function detectMemoryLeak(emitter: CoreEmitter): () => void {
  // Memory leak detection in development mode
  // eslint-disable-next-line node/prefer-global/process
  const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'

  let checkInterval: NodeJS.Timeout | undefined

  if (isDevelopment) {
    checkInterval = setInterval(() => {
      const eventNames = emitter.eventNames()
      const listenerCounts: Record<string, number> = {}

      eventNames.forEach((event) => {
        const count = emitter.listenerCount(event as any)
        if (count > 0) {
          listenerCounts[event as string] = count
        }
      })

      const totalListeners = Object.values(listenerCounts).reduce((sum, count) => sum + count, 0)

      if (totalListeners > 50) {
        useLogger('core:memory-leak').withFields({
          totalListeners,
          listenerCounts,
        }).warn('High number of event listeners detected - potential memory leak')
      }
      else {
        useLogger('core:memory-leak').withFields({
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
