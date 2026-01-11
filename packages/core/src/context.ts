import type { Logger } from '@guiiai/logg'
import type { CoreMetrics } from '@tg-search/common'
import type { TelegramClient } from 'telegram'

import type { CoreDB } from './db'
import type { Models } from './models'
import type { AccountSettings } from './types/account-settings'
import type { CoreEmitter, CoreEvent, CoreUserEntity, FromCoreEvent, ToCoreEvent } from './types/events'

import { useLogger } from '@guiiai/logg'
import { EventEmitter } from 'eventemitter3'

import { detectMemoryLeak } from './utils/memory-leak-detector'

export type { CoreEmitter, CoreEvent, ExtractData, FromCoreEvent, ToCoreEvent } from './types/events'

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

export function createCoreContext(db: () => CoreDB, models: Models, logger: Logger, metrics?: CoreMetrics): CoreContext {
  const emitter = new EventEmitter<CoreEvent>()
  const withError = createErrorHandler(emitter, logger)
  let telegramClient: TelegramClient
  let currentAccountId: string | undefined
  let myUser: CoreUserEntity | undefined

  const toCoreEvents = new Set<keyof ToCoreEvent>()
  const fromCoreEvents = new Set<keyof FromCoreEvent>()

  const wrapEmitterOn = (emitter: CoreEmitter, fn?: (event: keyof ToCoreEvent) => void) => {
    const _on = emitter.on.bind(emitter)

    // eslint-disable-next-line sonarjs/no-invariant-returns
    emitter.on = (event, listener) => {
      const onFn = _on(event, async (...args) => {
        try {
          fn?.(event as keyof ToCoreEvent)

          logger.withFields({ event }).debug('Handle core event')
          return await listener(...args)
        }
        catch (error) {
          logger.withError(error instanceof Error ? (error.cause ?? error) : error).error('Failed to handle core event')
        }
      })

      if (toCoreEvents.has(event as keyof ToCoreEvent)) {
        return onFn
      }

      logger.withFields({ event }).debug('Register to core event')
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

      logger.withFields({ event }).debug('Register from core event')

      fromCoreEvents.add(event as keyof FromCoreEvent)
      fn?.(event as keyof FromCoreEvent)

      return _emit(event, ...args)
    }
  }

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

// TODO: remove this
export function useService<T>(ctx: CoreContext, logger: Logger, fn: Service<T>) {
  logger = logger.withContext('core:service')

  logger.withFields({ fn: fn.name }).log('Register service')
  return fn(ctx, logger)
}
