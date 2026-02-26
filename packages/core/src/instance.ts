import type { Logger } from '@guiiai/logg'
import type { Config, CoreMetrics } from '@tg-search/common'
import type { Container } from 'injeca'

import type { CoreContext } from './context'
import type { CoreDB } from './db'
import type { MediaBinaryProvider } from './types'

import { useLogger } from '@guiiai/logg'
import { createContainer, invoke, provide, resolve, start, stop } from 'injeca'

import { createCoreContext } from './context'
import { afterConnectedEventHandler, basicEventHandler, useEventHandler } from './event-handlers'
import { models } from './models'
import { CoreEventType } from './types/events'

// Track containers for cleanup via destroyCoreInstance
const contextContainers = new WeakMap<CoreContext, Container>()

export async function createCoreInstance(
  db: () => CoreDB,
  config: Config,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
  logger?: Logger,
  metrics?: CoreMetrics,
): Promise<CoreContext> {
  logger ||= useLogger()

  const container = createContainer()

  const ctx = provide(container, 'core:context', {
    build: () => createCoreContext(db, models, logger!, metrics),
  })

  invoke(container, {
    dependsOn: { ctx },
    callback: ({ ctx: resolvedCtx }) => {
      const { register: registerEventHandler } = useEventHandler(resolvedCtx, config, mediaBinaryProvider, logger!)
      registerEventHandler(basicEventHandler)
      registerEventHandler(afterConnectedEventHandler)
    },
  })

  await start(container)

  const resolved = await resolve(container, { ctx })

  contextContainers.set(resolved.ctx, container)

  return resolved.ctx
}

/**
 * Destroy a CoreContext instance and clean up all resources
 *
 * This is called ONLY when a user explicitly logs out.
 * It ensures complete cleanup of all resources to prevent memory leaks.
 *
 * Cleanup Sequence:
 * 1. Stop the injeca container (triggers lifecycle hooks)
 * 2. Emit CoreEventType.CoreCleanup event for backward compatibility
 * 3. Await registered handler cleanup hooks
 * 4. Disconnect Telegram Client
 *    - Properly close the Telegram connection
 *    - Prevents hanging connections and resource leaks
 *
 * 5. Call ctx.cleanup()
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
 */
export async function destroyCoreInstance(ctx: CoreContext) {
  // Stop the injeca container if it exists
  const container = contextContainers.get(ctx)
  if (container) {
    await stop(container)
    contextContainers.delete(ctx)
  }

  // Emit cleanup event to notify all services
  ctx.emitter.emit(CoreEventType.CoreCleanup)

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
