import type { CoreEmitter } from '../context'

import { useLogger } from '@guiiai/logg'

export function detectMemoryLeak(emitter: CoreEmitter) {
  // Memory leak detection in development mode
  // eslint-disable-next-line node/prefer-global/process
  const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'

  if (isDevelopment) {
    const checkInterval = setInterval(() => {
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

    // Clean up interval on cleanup
    emitter.once('core:cleanup', () => {
      clearInterval(checkInterval)
    })
  }
}
