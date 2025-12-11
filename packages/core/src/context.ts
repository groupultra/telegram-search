import type { CoreMetrics } from '@tg-search/common'
import type { TelegramClient } from 'telegram'

import type { AccountSettings } from './types/account-settings'
import type { CoreEmitter, CoreEvent, FromCoreEvent, ToCoreEvent } from './types/events'

import { useLogger } from '@guiiai/logg'
import { EventEmitter } from 'eventemitter3'

import { useDrizzle } from './db'
import { fetchSettingsByAccountId, updateAccountSettings } from './models/account-settings'
import { detectMemoryLeak } from './utils/memory-leak-detector'

export type { CoreEmitter, CoreEvent, CoreEventData, FromCoreEvent, ToCoreEvent } from './types/events'

export interface CoreContext {
  emitter: CoreEmitter
  toCoreEvents: Set<keyof ToCoreEvent>
  fromCoreEvents: Set<keyof FromCoreEvent>
  wrapEmitterEmit: (emitter: CoreEmitter, fn?: (event: keyof FromCoreEvent) => void) => void
  wrapEmitterOn: (emitter: CoreEmitter, fn?: (event: keyof ToCoreEvent) => void) => void
  setClient: (client: TelegramClient) => void
  getClient: () => TelegramClient
  setCurrentAccountId: (accountId: string) => void
  getCurrentAccountId: () => string
  withError: (error: unknown, description?: string) => Error
  cleanup: () => void
  getAccountSettings: () => Promise<AccountSettings>
  setAccountSettings: (newSettings: AccountSettings) => Promise<unknown> // TODO: fix return type

  /**
   * Optional metrics sink for core operations.
   * - In browser environment, this is typically undefined.
   * - In server environment, this can be wired to Prometheus / OTEL metrics adapter.
   */
  metrics?: CoreMetrics
}

export type Service<T> = (ctx: CoreContext) => T

function createErrorHandler(emitter: CoreEmitter) {
  const logger = useLogger()

  return (error: unknown, description?: string): Error => {
    // Unwrap nested errors
    if (error instanceof Error && 'cause' in error) {
      return createErrorHandler(emitter)(error.cause, description)
    }

    // Emit raw error for frontend to handle (i18n, UI, etc.)
    emitter.emit('core:error', { error: error instanceof Error ? error.message : String(error), description })

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

export function createCoreContext(metrics?: CoreMetrics): CoreContext {
  const emitter = new EventEmitter<CoreEvent>()
  const withError = createErrorHandler(emitter)
  let telegramClient: TelegramClient
  let currentAccountId: string | undefined

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
          useLogger().withError(error instanceof Error ? (error.cause ?? error) : error).error('Failed to handle core event')
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

  function setCurrentAccountId(accountId: string) {
    useLogger().withFields({ accountId }).debug('Set current account ID')
    currentAccountId = accountId
  }

  function getCurrentAccountId(): string {
    if (!currentAccountId) {
      throw withError('Current account ID not set')
    }
    return currentAccountId
  }

  async function getAccountSettings(): Promise<AccountSettings> {
    return (await fetchSettingsByAccountId(useDrizzle(), getCurrentAccountId())).expect('Failed to fetch account settings')
  }

  async function setAccountSettings(newSettings: AccountSettings) {
    await updateAccountSettings(useDrizzle(), getCurrentAccountId(), newSettings)
  }

  // Setup memory leak detection and get cleanup function
  const cleanupMemoryLeakDetector = detectMemoryLeak(emitter)

  function cleanup() {
    useLogger().debug('Cleaning up CoreContext')

    // Clean up memory leak detector first
    cleanupMemoryLeakDetector()

    // Remove all event listeners
    emitter.removeAllListeners()

    // Clear event sets
    toCoreEvents.clear()
    fromCoreEvents.clear()

    // Clear client reference
    // @ts-expect-error - Allow setting to undefined for cleanup
    telegramClient = undefined

    // Clear account reference
    currentAccountId = undefined

    useLogger().debug('CoreContext cleaned up')
  }

  wrapEmitterOn(emitter, (event) => {
    useLogger('core:event').withFields({ event }).debug('Core event received')
  })

  wrapEmitterEmit(emitter, (event) => {
    useLogger('core:event').withFields({ event }).debug('Core event emitted')
  })

  return {
    emitter,
    toCoreEvents,
    fromCoreEvents,
    wrapEmitterEmit,
    wrapEmitterOn,
    setClient,
    getClient: ensureClient,
    setCurrentAccountId,
    getCurrentAccountId,
    withError,
    cleanup,
    getAccountSettings,
    setAccountSettings,
    metrics,
  }
}

export function useService<T>(ctx: CoreContext, fn: Service<T>) {
  useLogger().withFields({ fn: fn.name }).log('Register service')
  return fn(ctx)
}
