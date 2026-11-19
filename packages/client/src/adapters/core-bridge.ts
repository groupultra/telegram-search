import type { Config } from '@tg-search/common'
import type { SignInTicketResult, UiCommandInput, UiCommandType, UiNotificationData, UiNotificationType } from '@tg-search/core'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'

import { useLogger } from '@guiiai/logg'
import { createContext } from '@moeru/eventa'
import { deepClone, generateDefaultConfig } from '@tg-search/common'
import { registerUiHandlers } from '@tg-search/core'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'

import { DEV_MODE, IS_CORE_MODE, TELEGRAM_APP_HASH, TELEGRAM_APP_ID } from '../constants'
import { useSetupPGliteDevtools } from '../devtools/pglite-devtools'
import { getRegisterEventHandler } from '../event-handlers'
import { registerAllEventHandlers } from '../event-handlers/register'
import { useSessionStore } from '../stores/useSession'
import { drainEventQueue, enqueueEventHandler } from '../utils/event-queue'
import { initDB } from './core-db'
import { createCoreRuntime } from './core-runtime'
import { createLocalApplicationBridge } from './eventa-local'
import { emitUiCommand, listenUiNotifications } from './ui-eventa'

export function createCoreBridgeAdapter(createRuntime = createCoreRuntime) {
  const sessionStore = useSessionStore()
  const { activeSessionId } = storeToRefs(sessionStore)
  const logger = useLogger('CoreBridge')

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const isInitialized = ref(false)
  const config = useLocalStorage<Config>('core-bridge/config', generateDefaultConfig())
  const coreRuntime = createRuntime(config, logger)
  let generation = 0
  let switching = false
  let disposed = false
  let transition = Promise.resolve()
  const application = createLocalApplicationBridge(() => {
    if (switching || disposed)
      throw new Error('Core account is switching or disposed')
    return coreRuntime.getCtx()
  })

  const registerEventHandler = getRegisterEventHandler(eventHandlers)

  // Browser-only mode binds the same UI contracts as the server, on an
  // in-memory Eventa context, so both modes validate commands the same way.
  const uiContext = createContext()
  let unbindCore: (() => void) | undefined
  listenUiNotifications(uiContext, dispatch)

  function bindCore() {
    unbindCore?.()
    unbindCore = registerUiHandlers(uiContext, coreRuntime.getCtx(), { logger })
  }

  function releaseCore() {
    unbindCore?.()
    unbindCore = undefined
  }

  // React to session switches: Destroy old context, create new one
  watch(activeSessionId, (newId, oldId) => {
    if (!oldId || newId === oldId)
      return

    logger.withFields({ oldId, newId }).debug('Active session changed, destroying CoreContext')
    const nextGeneration = ++generation
    switching = true
    // Stop forwarding the old context's events now; late events from it
    // (for example a logout) must not reach the new account's UI.
    releaseCore()
    transition = transition.then(async () => {
      await application.reset()
      await coreRuntime.destroy()
      if (disposed || nextGeneration !== generation)
        return
      // Re-register handlers for the new context
      registerAllEventHandlers(registerEventHandler)
      bindCore()
      switching = false
      dispatch('server:connected', { sessionId: newId || '', accountReady: false })
    }).catch((error) => {
      logger.withError(error).error('Failed to destroy CoreContext on account switch')
    })
  }, { flush: 'sync' })

  onScopeDispose(() => {
    disposed = true
    generation++
    releaseCore()
    transition = transition.then(async () => {
      await application.dispose()
      await coreRuntime.destroy()
    }).catch(error => logger.withError(error).error('Failed to dispose CoreContext'))
  })

  function sendEvent<T extends UiCommandType>(event: T, data?: UiCommandInput<T>) {
    if (disposed || switching)
      throw new Error('Core account is switching or disposed')
    if (!unbindCore)
      bindCore()
    logger.withFields({ event, data }).debug('Emit event to core')
    void emitUiCommand(uiContext, event, deepClone(data))
  }

  async function init() {
    if (isInitialized.value) {
      logger.debug('Core bridge already initialized, skipping')
      return
    }

    logger.verbose('Initializing core bridge')
    config.value.api.telegram.apiId ||= TELEGRAM_APP_ID
    config.value.api.telegram.apiHash ||= TELEGRAM_APP_HASH

    const db = await initDB(logger, config.value)

    if (IS_CORE_MODE) {
      const { registerOpfsMediaStorage } = await import('./core-media-opfs')
      try {
        await registerOpfsMediaStorage()
        logger.debug('Registered OPFS media storage provider')
      }
      catch (error) {
        logger.withError(error).warn('Failed to register OPFS media storage provider; falling back to DB bytea')
      }
    }

    if (DEV_MODE && typeof window !== 'undefined') {
      const setupDevtools = useSetupPGliteDevtools()
      setupDevtools?.(db.pglite)
    }

    registerAllEventHandlers(registerEventHandler)
    bindCore()

    // Initial connection event
    dispatch('server:connected', { sessionId: activeSessionId.value || '', accountReady: false })
    isInitialized.value = true
  }

  function waitForEvent<T extends UiNotificationType>(
    event: T,
    predicate?: (data: UiNotificationData<T>) => boolean,
  ) {
    logger.withFields({ event }).debug('Waiting for event from core')
    return new Promise<UiNotificationData<T>>((resolve) => {
      enqueueEventHandler(eventHandlersQueue, event, (data: UiNotificationData<T>) => {
        resolve(deepClone(data) as UiNotificationData<T>)
      }, predicate)
    })
  }

  function dispatch<T extends UiNotificationType>(type: T, data: UiNotificationData<T>) {
    logger.withFields({ type }).debug('Event send to bridge')
    const fn = eventHandlers.get(type)
    if (fn) {
      try {
        fn(deepClone(data) as UiNotificationData<UiNotificationType>)
      }
      catch (error) { logger.withError(error).error('Failed to handle event') }
    }
    if (eventHandlersQueue.has(type)) {
      drainEventQueue(eventHandlersQueue, type, deepClone(data) as UiNotificationData<T>, (error) => {
        logger.withError(error).error('Failed to handle queued event')
      })
    }
  }

  // Browser-only mode has no server, so there is no server session to sign in to.
  async function requestSignInTicket(): Promise<SignInTicketResult> {
    return { error: 'OAUTH_DISABLED' }
  }

  return {
    application,
    init,
    sendEvent,
    waitForEvent,
    requestSignInTicket,
  }
}

export const useCoreBridgeAdapter = defineStore('core-bridge-adapter', () => createCoreBridgeAdapter())

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCoreBridgeAdapter, import.meta.hot))
}
