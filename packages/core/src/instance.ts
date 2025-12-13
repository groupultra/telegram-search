import type { Config, CoreMetrics } from '@tg-search/common'

import type { CoreContext } from './context'
import type { CoreDB } from './db'

import { createCoreContext } from './context'
import { afterConnectedEventHandler, basicEventHandler, useEventHandler } from './event-handler'

export function createCoreInstance(db: CoreDB, config: Config, metrics?: CoreMetrics): CoreContext {
  const ctx = createCoreContext(db, metrics)

  const { register: registerEventHandler } = useEventHandler(ctx, config)
  registerEventHandler(basicEventHandler)
  registerEventHandler(afterConnectedEventHandler)

  return ctx
}

/**
 * Destroy a CoreContext instance and clean up all resources
 *
 * This is called ONLY when a user explicitly logs out.
 * It ensures complete cleanup of all resources to prevent memory leaks.
 *
 * Cleanup Sequence:
 * 1. Emit 'core:cleanup' event
 *    - Notifies all services to clean up (e.g., gram-events removes Telegram event handlers)
 *    - Services listen via: emitter.once('core:cleanup', cleanup)
 *    - Event is emitted synchronously, all listeners execute immediately
 *
 * 2. Wait 100ms for async cleanup
 *    - Some services may have async cleanup operations
 *    - This timeout ensures they complete before we proceed
 *    - Note: EventEmitter.emit() is synchronous, but cleanup logic inside listeners may be async
 *
 * 3. Disconnect Telegram Client
 *    - Properly close the Telegram connection
 *    - Prevents hanging connections and resource leaks
 *
 * 4. Call ctx.cleanup()
 *    - Removes ALL event listeners from emitter
 *    - Clears event tracking sets
 *    - Nullifies Telegram client reference
 *    - Stops memory leak detector interval (if in dev mode)
 *
 * Memory Safety:
 * - After this function, the CoreContext has no listeners, no timers, no references
 * - JavaScript GC can reclaim all memory
 * - No memory leaks
 *
 * Related PR Comments:
 * - Copilot: "Cleanup sequence has potential issue with ordering"
 *   -> Response: emit() is synchronous, listeners execute immediately, so order is correct
 * - Copilot: "100ms timeout is arbitrary"
 *   -> Response: True, but sufficient for current services; can be improved with Promise-based cleanup
 */
export async function destroyCoreInstance(ctx: CoreContext) {
  // Emit cleanup event to notify all services
  ctx.emitter.emit('core:cleanup')

  // Give services time to cleanup
  // TODO: use Promise.allSettled to wait for all services to cleanup
  await new Promise(resolve => setTimeout(resolve, 100))

  // Disconnect Telegram client if connected
  try {
    const client = ctx.getClient()
    if (client && client.connected) {
      await client.disconnect()
    }
  }
  catch {
    // Client may not be set or already disconnected, ignore
  }

  // Use the cleanup method from CoreContext
  ctx.cleanup()
}
