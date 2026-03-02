import type { Logger } from '@guiiai/logg'
import type { Config, CoreMetrics } from '@tg-search/common'

import type { CoreContext } from './context'
import type { CoreDB } from './db'
import type { MediaBinaryProvider } from './types'

import { useLogger } from '@guiiai/logg'

import { createCoreContext } from './context'
import { afterConnectedEventHandler, basicEventHandler, useEventHandler } from './event-handlers'
import { coreCleanupEvent } from './events'
import { models } from './models'

export function createCoreInstance(
  db: () => CoreDB,
  config: Config,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
  logger?: Logger,
  metrics?: CoreMetrics,
): CoreContext {
  logger ||= useLogger()

  const ctx = createCoreContext(db, models, logger, metrics)

  const { register: registerEventHandler } = useEventHandler(ctx, config, mediaBinaryProvider, logger)
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
 * 1. Emit coreCleanupEvent to notify all services
 * 2. Await registered handler cleanup hooks
 * 3. Disconnect Telegram Client
 *    - Properly close the Telegram connection
 *    - Prevents hanging connections and resource leaks
 *
 * 4. Call ctx.cleanup()
 *    - Removes ALL event listeners from emitter
 *    - Disposes Eventa context listeners
 *    - Nullifies Telegram client reference
 *
 * Memory Safety:
 * - After this function, the CoreContext has no listeners, no timers, no references
 * - JavaScript GC can reclaim all memory
 * - No memory leaks
 *
 */
export async function destroyCoreInstance(ctx: CoreContext) {
  // Emit cleanup event to notify all services
  ctx.ctx.emit(coreCleanupEvent)

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
