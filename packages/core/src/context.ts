import type { Logger } from '@guiiai/logg'
import type { Eventa, InvocableEventContext } from '@moeru/eventa'
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
// CoreEventContext: Raw Eventa EventContext (supports invoke handlers)
// ============================================================================

/**
 * The Eventa EventContext type used throughout the core package.
 * Supports both regular events (on/emit) and invoke handlers (defineInvokeHandler).
 */
export type CoreEventContext = InvocableEventContext<any, any>

// ============================================================================
// CoreContext
// ============================================================================

export interface CoreContext {
  /**
   * Raw Eventa EventContext for event handling.
   *
   * - For fire-and-forget: use `safeOn(ctx.eventContext, event, handler, logger)` or `ctx.eventContext.on(event, handler)`
   * - For emit: use `ctx.eventContext.emit(event, data)`
   * - For RPC handlers: use `defineInvokeHandler(ctx.eventContext, invokeEvent, handler)`
   * - For RPC callers: use `defineInvoke(ctx.eventContext, invokeEvent)(requestData)`
   *
   * NOTE: Raw `ctx.eventContext.on()` handlers receive the full Eventa envelope. Access data via `envelope.body`.
   */
  eventContext: CoreEventContext

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

// ============================================================================
// Helper: Safe event handler for fire-and-forget events
// ============================================================================

/**
 * Register a fire-and-forget event handler with automatic error logging.
 * Wraps the handler in try-catch to prevent unhandled rejections.
 *
 * For invoke (RPC) events, use `defineInvokeHandler` instead – errors
 * propagate via Promise rejection automatically.
 */
export function safeOn<P>(
  eventContext: CoreEventContext,
  event: Eventa<P>,
  handler: (data: P) => void | Promise<void>,
  logger: Logger,
): () => void {
  return eventContext.on(event, async (envelope: Eventa<P>) => {
    try {
      logger.withFields({ event: event.id }).debug('Handle core event')
      await handler(envelope.body as P)
    }
    catch (error) {
      logger.withError(error instanceof Error ? (error.cause ?? error) : error).error('Failed to handle core event')
    }
  })
}

/**
 * Register a one-time fire-and-forget event handler with automatic error logging.
 */
export function safeOnce<P>(
  eventContext: CoreEventContext,
  event: Eventa<P>,
  handler: (data: P) => void | Promise<void>,
  logger: Logger,
): () => void {
  return eventContext.once(event, async (envelope: Eventa<P>) => {
    try {
      logger.withFields({ event: event.id }).debug('Handle core event (once)')
      await handler(envelope.body as P)
    }
    catch (error) {
      logger.withError(error instanceof Error ? (error.cause ?? error) : error).error('Failed to handle core event (once)')
    }
  })
}

// ============================================================================
// Error Handler
// ============================================================================

function createErrorHandler(eventContext: CoreEventContext, logger: Logger) {
  return (error: unknown, description?: string): Error => {
    // Unwrap nested errors
    if (error instanceof Error && 'cause' in error) {
      return createErrorHandler(eventContext, logger)(error.cause, description)
    }

    // Emit raw error for frontend to handle (i18n, UI, etc.)
    eventContext.emit(CoreError, { error: error instanceof Error ? error.message : String(error), description })

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

// ============================================================================
// Factory
// ============================================================================

export function createCoreContext(db: () => CoreDB, models: Models, logger: Logger, metrics?: CoreMetrics): CoreContext {
  const eventContext = createContext() as CoreEventContext
  const withError = createErrorHandler(eventContext, logger)
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
  const cleanupMemoryLeakDetector = detectMemoryLeak(eventContext, logger)

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
    eventContext.listeners.clear()
    eventContext.onceListeners.clear()

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
    eventContext,
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
export type { Eventa, EventContext, InvocableEventContext, InvokeEventa } from '@moeru/eventa'
