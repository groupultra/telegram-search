import type { Logger } from '@guiiai/logg'
import type { EventContext } from '@moeru/eventa'
import type { CoreMetrics } from '@tg-search/common'
import type { TelegramClient } from 'telegram'

import type { CoreDB } from './db'
import type { Models } from './models'
import type { AccountSettings } from './types/account-settings'
import type { CoreUserEntity } from './types/events'

import { useLogger } from '@guiiai/logg'
import { createContext } from '@moeru/eventa'

import { coreErrorEvent } from './events'

export interface CoreContext {
  /** Eventa event context — the central hub for all event emission and subscription */
  ctx: EventContext
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

function createErrorHandler(eventaCtx: EventContext, logger: Logger) {
  return (error: unknown, description?: string): Error => {
    // Unwrap nested errors
    if (error instanceof Error && 'cause' in error) {
      return createErrorHandler(eventaCtx, logger)(error.cause, description)
    }

    // Emit raw error for frontend to handle (i18n, UI, etc.)
    eventaCtx.emit(coreErrorEvent, { error: error instanceof Error ? error.message : String(error), description })

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
  const eventaCtx = createContext()
  const withError = createErrorHandler(eventaCtx, logger)
  let telegramClient: TelegramClient
  let currentAccountId: string | undefined
  let myUser: CoreUserEntity | undefined

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

  function getDB(): CoreDB {
    const dbInstance = db()
    if (!dbInstance) {
      throw withError('Database not initialized')
    }
    return dbInstance
  }

  function cleanup() {
    useLogger('core:context').debug('Cleaning up CoreContext')

    // Clear client reference
    // @ts-expect-error - Allow setting to undefined for cleanup
    telegramClient = undefined

    // Clear account reference
    currentAccountId = undefined

    useLogger('core:context').debug('CoreContext cleaned up')
  }

  return {
    ctx: eventaCtx,
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
