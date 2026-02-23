import type { Logger } from '@guiiai/logg'
import type { Config, CoreMetrics } from '@tg-search/common'

import type { CoreContext } from './context'
import type { CoreDB } from './db'
import type { EventHandler, EventHandlerDependencies } from './event-handlers'
import type { MediaBinaryProvider } from './types'

import { LogLevel, useLogger } from '@guiiai/logg'
import { createLoggLogger, injeca } from 'injeca'
import { resetContainer } from 'injeca/global'

import { createCoreContext } from './context'
import { afterConnectedEventHandler, basicEventHandler, defaultEventHandlerDependencies } from './event-handlers'
import { models } from './models'
import { CoreEventType } from './types/events'

const eventHandlerCleanupRegistry = new WeakMap<CoreContext, () => Promise<void>>()

export interface CoreInstanceOptions {
  deps?: Partial<EventHandlerDependencies>
  dependencies?: Partial<EventHandlerDependencies>
  eventHandlers?: EventHandler[]
}

export function createCoreInstance(
  db: () => CoreDB,
  config: Config,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
  logger?: Logger,
  metrics?: CoreMetrics,
  options: CoreInstanceOptions = {},
): CoreContext {
  logger ||= useLogger()

  // Use a fresh singleton container per core instance to avoid stale provider cache.
  resetContainer()
  injeca.setLogger(createLoggLogger(logger.withContext('injeca').withLogLevel(LogLevel.Debug)))

  const ctx = createCoreContext(db, models, logger, metrics)
  const mergedDeps: EventHandlerDependencies = {
    ...defaultEventHandlerDependencies,
    ...(options.dependencies ?? {}),
    ...(options.deps ?? {}),
  }
  const eventHandlers = options.eventHandlers ?? [basicEventHandler, afterConnectedEventHandler]
  const eventHandlerLogger = logger.withContext('core:event-handler')
  const depsProvider = injeca.provide('core:event-handler:deps', () => mergedDeps)
  const handlerSetupTasks: Promise<void>[] = []
  const handlerCleanupTasks: Array<{
    handlerName: string
    cleanup: () => void | Promise<void>
  }> = []
  let registrationSeq = 0

  for (const fn of eventHandlers) {
    const handlerName = fn.name || 'anonymous'
    const providerName = `core:event-handler:${handlerName}:${registrationSeq}`
    registrationSeq += 1
    eventHandlerLogger.withFields({ fn: handlerName }).log('Register event handler')

    const handlerProvider = injeca.provide(providerName, {
      dependsOn: { deps: depsProvider },
      build: ({ dependsOn }) => {
        const cleanup = fn(ctx, config, mediaBinaryProvider, dependsOn.deps)
        if (typeof cleanup === 'function') {
          handlerCleanupTasks.push({ handlerName, cleanup })
        }
      },
    })

    const setupTask = injeca.resolve({ _: handlerProvider })
      .then(() => undefined)
      .catch((error) => {
        eventHandlerLogger.withError(error).error(`Failed to initialize event handler: ${handlerName}`)
      })
    handlerSetupTasks.push(setupTask)
  }

  eventHandlerCleanupRegistry.set(ctx, async () => {
    // Ensure all providers are initialized before running cleanup hooks.
    await Promise.allSettled(handlerSetupTasks)

    for (const { handlerName, cleanup } of handlerCleanupTasks) {
      try {
        await cleanup()
      }
      catch (error) {
        eventHandlerLogger.withError(error).error(`Failed to cleanup event handler: ${handlerName}`)
      }
    }

    resetContainer()
  })

  return ctx
}

/**
 * Destroy a CoreContext instance and clean up all resources
 *
 * This is called ONLY when a user explicitly logs out.
 * It ensures complete cleanup of all resources to prevent memory leaks.
 *
 * Cleanup Sequence:
 * 1. Emit CoreEventType.CoreCleanup event for backward compatibility
 * 2. Await registered handler cleanup hooks
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
 */
export async function destroyCoreInstance(ctx: CoreContext) {
  // Emit cleanup event to notify all services
  ctx.emitter.emit(CoreEventType.CoreCleanup)

  // Await explicit cleanup hooks registered by event handlers.
  const cleanupEventHandlers = eventHandlerCleanupRegistry.get(ctx)
  if (cleanupEventHandlers) {
    await cleanupEventHandlers()
  }

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
  eventHandlerCleanupRegistry.delete(ctx)
}
