import type { TelegramClient } from 'telegram'

import type {
  CoreEmitter,
  CoreEvent,
  FromCoreEvent,
  ToCoreEvent,
} from './types/events'

import { useLogger } from '@guiiai/logg'
import { EventEmitter } from 'eventemitter3'

export type { CoreEmitter, CoreEvent, CoreEventData, FromCoreEvent, ToCoreEvent } from './types/events'

export type CoreContext = ReturnType<typeof createCoreContext>

export type Service<T> = (ctx: CoreContext) => T

function createErrorHandler(emitter: CoreEmitter) {
  const logger = useLogger()

  return (error: unknown, description?: string): Error => {
    // Unwrap nested errors
    if (error instanceof Error && 'cause' in error) {
      return createErrorHandler(emitter)(error.cause, description)
    }

    // Emit raw error for frontend to handle (i18n, UI, etc.)
    emitter.emit('core:error', { error })

    // Log error details
    if (error instanceof Error) {
      logger.withError(error).error(description || error.message)
    }
    else {
      logger.withError(error).error(description || 'Unknown error')
    }

    // Return error as-is for further handling
    return error instanceof Error ? error : new Error(description || 'Error occurred')
  }
}

export function createCoreContext() {
  const emitter = new EventEmitter<CoreEvent>()
  const withError = createErrorHandler(emitter)
  let telegramClient: TelegramClient

  const toCoreEvents = new Set<keyof ToCoreEvent>()
  const fromCoreEvents = new Set<keyof FromCoreEvent>()

  const wrapEmitterOn = (emitter: CoreEmitter, fn?: (event: keyof ToCoreEvent) => void) => {
    const _on = emitter.on.bind(emitter)

    emitter.on = (event, listener) => {
      const onFn = _on(event, async (...args) => {
        try {
          fn?.(event as keyof ToCoreEvent)

          useLogger().withFields({ event }).debug('Handle core event')
          return await listener(...args)
        }
        catch (error) {
          useLogger().withError(error).error('Failed to handle core event')
        }
      })

      if (toCoreEvents.has(event as keyof ToCoreEvent)) {
        return onFn
      }

      useLogger().withFields({ event }).debug('Register to core event')
      toCoreEvents.add(event as keyof ToCoreEvent)
      return onFn
    }
  }

  const wrapEmitterEmit = (emitter: CoreEmitter, fn?: (event: keyof FromCoreEvent) => void) => {
    const _emit = emitter.emit.bind(emitter)

    emitter.emit = (event, ...args) => {
      if (fromCoreEvents.has(event as keyof FromCoreEvent)) {
        return _emit(event, ...args)
      }

      useLogger().withFields({ event }).debug('Register from core event')

      fromCoreEvents.add(event as keyof FromCoreEvent)
      fn?.(event as keyof FromCoreEvent)

      return _emit(event, ...args)
    }
  }

  function setClient(client: TelegramClient) {
    useLogger().debug('Set Telegram client')
    telegramClient = client
  }

  function ensureClient(): TelegramClient {
    if (!telegramClient) {
      throw withError('Telegram client not set')
    }

    return telegramClient
  }

  function cleanup() {
    useLogger().debug('Cleaning up CoreContext')

    // Remove all event listeners
    emitter.removeAllListeners()

    // Clear event sets
    toCoreEvents.clear()
    fromCoreEvents.clear()

    // Clear client reference
    // @ts-expect-error - Allow setting to undefined for cleanup
    telegramClient = undefined

    useLogger().debug('CoreContext cleaned up')
  }

  wrapEmitterOn(emitter, (event) => {
    useLogger('core:event').withFields({ event }).debug('Core event received')
  })

  wrapEmitterEmit(emitter, (event) => {
    useLogger('core:event').withFields({ event }).debug('Core event emitted')
  })

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

  return {
    emitter,
    toCoreEvents,
    fromCoreEvents,
    wrapEmitterEmit,
    wrapEmitterOn,
    setClient,
    getClient: ensureClient,
    withError,
    cleanup,
  }
}

export function useService<T>(ctx: CoreContext, fn: Service<T>) {
  useLogger().withFields({ fn: fn.name }).log('Register service')
  return fn(ctx)
}
