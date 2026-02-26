import type { Logger } from '@guiiai/logg'
import type { Eventa, EventContext } from '@moeru/eventa'
import type { CoreMetrics } from '@tg-search/common'
import type { TelegramClient } from 'telegram'

import type { CoreDB } from './db'
import type { Models } from './models'
import type { AccountSettings } from './types/account-settings'
import type { CoreUserEntity, FromCoreEventPayloadMap, ToCoreEventPayloadMap } from './types/events'

import { useLogger } from '@guiiai/logg'
import { createContext } from '@moeru/eventa'

import { CoreError } from './types/events'
import { detectMemoryLeak } from './utils/memory-leak-detector'

// ============================================================================
// CoreEmitter: Eventa-based event bus wrapper
// ============================================================================

/**
 * Wrapper around Eventa's EventContext that provides a simplified API
 * where handlers receive the payload directly (not the full Eventa envelope).
 */
export interface CoreEmitter {
  on: <P>(event: Eventa<P>, handler: (data: P) => void | Promise<void> | Promise<any>) => () => void
  once: <P>(event: Eventa<P>, handler: (data: P) => void | Promise<void> | Promise<any>) => () => void
  emit: <P>(event: Eventa<P>, ...args: [P] extends [undefined] ? [] | [data?: P] : [data: P]) => void
  off: <P>(event: Eventa<P>) => void
  removeAllListeners: () => void

  /** Access underlying Eventa context for advanced use (adapters, matchBy, etc.) */
  readonly raw: EventContext<any, any>
}

export function createCoreEmitter(logger: Logger): CoreEmitter {
  const ctx = createContext()

  function on<P>(event: Eventa<P>, handler: (data: P) => void | Promise<void>): () => void {
    const wrappedHandler = async (eventa: Eventa<P>) => {
      try {
        logger.withFields({ event: event.id }).debug('Handle core event')
        await handler(eventa.body as P)
      }
      catch (error) {
        logger.withError(error instanceof Error ? (error.cause ?? error) : error).error('Failed to handle core event')
      }
    }

    return ctx.on(event, wrappedHandler)
  }

  function once<P>(event: Eventa<P>, handler: (data: P) => void | Promise<void>): () => void {
    const wrappedHandler = async (eventa: Eventa<P>) => {
      try {
        logger.withFields({ event: event.id }).debug('Handle core event (once)')
        await handler(eventa.body as P)
      }
      catch (error) {
        logger.withError(error instanceof Error ? (error.cause ?? error) : error).error('Failed to handle core event (once)')
      }
    }

    return ctx.once(event, wrappedHandler)
  }

  function emit<P>(event: Eventa<P>, ...args: [P] extends [undefined] ? [] | [data?: P] : [data: P]): void {
    const data = args[0] as P
    logger.withFields({ event: event.id }).debug('Emit core event')
    ctx.emit(event, data)
  }

  function off<P>(event: Eventa<P>): void {
    ctx.off(event)
  }

  function removeAllListeners(): void {
    // Clear all listener maps on the raw context
    ctx.listeners.clear()
    ctx.onceListeners.clear()
  }

  return {
    on,
    once,
    emit,
    off,
    removeAllListeners,
    get raw() {
      return ctx
    },
  }
}

// ============================================================================
// CoreContext
// ============================================================================

export interface CoreContext {
  emitter: CoreEmitter
  toCoreEvents: Set<keyof ToCoreEventPayloadMap>
  fromCoreEvents: Set<keyof FromCoreEventPayloadMap>
  setClient: (client: TelegramClient) => void
  getClient: () => TelegramClient
  setCurrentAccountId: (accountId: string) => void
  getCurrentAccountId: () => string
  setMyUser: (newMyUser: CoreUserEntity) => void
  getMyUser: () => CoreUserEntity
  getDB: () => CoreDB
  withError: (error: unknown, description?: string) => Error
  cleanup: () => void
  getAccountSettings: () => Promise<AccountSettings>
  setAccountSettings: (newSettings: AccountSettings) => Promise<void>

  /**
   * Optional metrics sink for core operations.
   * - In browser environment, this is typically undefined.
   * - In server environment, this can be wired to Prometheus / OTEL metrics adapter.
   */
  metrics?: CoreMetrics
}

export type Service<T> = (ctx: CoreContext, logger: Logger) => T

function createErrorHandler(emitter: CoreEmitter, logger: Logger) {
  return (error: unknown, description?: string): Error => {
    // Unwrap nested errors
    if (error instanceof Error && 'cause' in error) {
      return createErrorHandler(emitter, logger)(error.cause, description)
    }

    // Emit raw error for frontend to handle (i18n, UI, etc.)
    emitter.emit(CoreError, { error: error instanceof Error ? error.message : String(error), description })

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

export function createCoreContext(db: () => CoreDB, models: Models, logger: Logger, metrics?: CoreMetrics): CoreContext {
  const emitter = createCoreEmitter(logger)
  const withError = createErrorHandler(emitter, logger)
  let telegramClient: TelegramClient
  let currentAccountId: string | undefined
  let myUser: CoreUserEntity | undefined

  const toCoreEvents = new Set<keyof ToCoreEventPayloadMap>()
  const fromCoreEvents = new Set<keyof FromCoreEventPayloadMap>()

  function setClient(client: TelegramClient) {
    logger.debug('Set Telegram client')
    telegramClient = client
  }

  function ensureClient(): TelegramClient {
    if (!telegramClient) {
      throw withError('Telegram client not set')
    }

    return telegramClient
  }

  function setCurrentAccountId(accountId: string) {
    logger.withFields({ accountId }).debug('Set current account ID')
    currentAccountId = accountId
  }

  function getCurrentAccountId(): string {
    if (!currentAccountId) {
      throw withError('Current account ID not set')
    }
    return currentAccountId
  }

  function setMyUser(newMyUser: CoreUserEntity) {
    logger.withFields({ userId: newMyUser.id }).debug('Set my user')
    myUser = newMyUser
  }

  function getMyUser(): CoreUserEntity {
    if (!myUser) {
      throw withError('My user not set')
    }
    return myUser
  }

  async function getAccountSettings(): Promise<AccountSettings> {
    if (!models) {
      throw withError('Models not initialized')
    }
    return (await models.accountSettingsModels.fetchSettingsByAccountId(getDB(), getCurrentAccountId())).expect('Failed to fetch account settings')
  }

  async function setAccountSettings(newSettings: AccountSettings) {
    if (!models) {
      throw withError('Models not initialized')
    }
    await models.accountSettingsModels.updateAccountSettings(getDB(), getCurrentAccountId(), newSettings)
  }

  // Setup memory leak detection and get cleanup function
  const cleanupMemoryLeakDetector = detectMemoryLeak(emitter, logger)

  function getDB(): CoreDB {
    const dbInstance = db()
    if (!dbInstance) {
      throw withError('Database not initialized')
    }
    return dbInstance
  }

  function cleanup() {
    logger.debug('Cleaning up CoreContext')

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

    logger.debug('CoreContext cleaned up')
  }

  // Log context creation
  useLogger('core:event').debug('CoreContext created with Eventa event system')

  return {
    emitter,
    toCoreEvents,
    fromCoreEvents,
    setClient,
    getClient: ensureClient,
    setCurrentAccountId,
    getCurrentAccountId,
    setMyUser,
    getMyUser,
    getDB,
    withError,
    cleanup,
    getAccountSettings,
    setAccountSettings,
    metrics,
  }
}

export type {
  CoreEventAll,
  CoreEventMeta,
  CoreEventPayloadMap,
  EventaPayload,
  ExtractData,
  FromCoreEvent,
  FromCoreEventPayloadMap,
  ToCoreEvent,
  ToCoreEventPayloadMap,
} from './types/events'
// Re-exports for consumers
export type { Eventa, EventContext } from '@moeru/eventa'
