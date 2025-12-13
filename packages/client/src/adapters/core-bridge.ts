import type { Config } from '@tg-search/common'
import type { CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { StoredSession } from '../types/session'

import { useLogger } from '@guiiai/logg'
import { deepClone, generateDefaultConfig } from '@tg-search/common'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

import { useSetupPGliteDevtools } from '../devtools/pglite-devtools'
import { getRegisterEventHandler } from '../event-handlers'
import { registerAllEventHandlers } from '../event-handlers/register'
import { drainEventQueue, enqueueEventHandler } from '../utils/event-queue'
import { createSessionStore } from '../utils/session-store'
import { initDB } from './core-db'
import { createCoreRuntime } from './core-runtime'

export const useCoreBridgeStore = defineStore('core-bridge', () => {
  const storageSessions = useLocalStorage<StoredSession[]>('core-bridge/sessions', [])
  // active-session-slot: index into storageSessions array
  const storageActiveSessionSlot = useLocalStorage<number>('core-bridge/active-session-slot', 0)
  const logger = useLogger('CoreBridge')

  const {
    ensureSessionInvariants,
    getActiveSession,
    updateActiveSessionMetadata,
    updateSessionMetadataById,
    addNewAccount,
    removeCurrentAccount,
    cleanup: resetSessions,
  } = createSessionStore(storageSessions, storageActiveSessionSlot, { generateId: () => uuidv4() })

  const activeSessionId = computed(() => {
    const slot = storageActiveSessionSlot.value
    const session = storageSessions.value[slot]
    return session?.uuid ?? ''
  })

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const isInitialized = ref(false)
  const config = useLocalStorage<Config>('core-bridge/config', generateDefaultConfig())
  const coreRuntime = createCoreRuntime(config, logger)

  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)

  ensureSessionInvariants()

  // When switching accounts, destroy the existing CoreContext so that the
  // next interaction will create a fresh instance for the new account.
  watch(activeSessionId, (newId, oldId) => {
    if (!oldId || newId === oldId)
      return
    logger.withFields({ oldId, newId }).debug('Active session changed, destroying CoreContext')
    coreRuntime.destroy().then(() => {
      // After tearing down the old CoreContext, re-register client-side
      // event handlers. These will emit server:event:register events and
      // lazily create a fresh CoreContext via ensureCtx / coreRuntime.
      registerAllEventHandlers(registerEventHandler)
    }).catch((error) => {
      logger.withError(error).error('Failed to destroy CoreContext on account switch')
    })
  })

  function ensureCtx() {
    // Lazily create a CoreContext via runtime helper. This function is kept
    // minimal on purpose; event wiring is handled explicitly in init() and
    // in the account-switch watcher above.
    return coreRuntime.getCtx()
  }

  const switchAccount = (sessionId: string) => {
    const index = storageSessions.value.findIndex(session => session.uuid === sessionId)
    if (index !== -1) {
      // When switching to an existing account, optimistically mark its
      // connection state as disconnected. AuthStore's auto-login watcher
      // will observe the combination of { hasSession, !isConnected } for
      // the new active slot and trigger a fresh login using the stored
      // session string.
      updateSessionMetadataById(sessionId, { isConnected: false })

      storageActiveSessionSlot.value = index
      logger.withFields({ sessionId }).verbose('Switched to account')
    }
  }

  /**
   * Apply session:update to the current active account.
   *
   * We rely on the caller to select the appropriate active slot before
   * triggering the login flow.
   */
  const applySessionUpdate = (session: string) => {
    updateActiveSessionMetadata({ session })
  }

  const logoutCurrentAccount = async () => {
    const removed = removeCurrentAccount()
    if (!removed)
      return

    // Emit logout event
    sendEvent('auth:logout', undefined)
  }

  /**
   * Send event to core
   */
  function sendEvent<T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) {
    const ctx = ensureCtx()!
    logger.withFields({ event, data }).debug('Receive event from client')

    try {
      if (event === 'server:event:register') {
        data = data as WsEventToServerData<'server:event:register'>
        const eventName = data.event as keyof FromCoreEvent

        if (!eventName.startsWith('server:')) {
          const fn = (payload: WsEventToClientData<keyof FromCoreEvent>) => {
            logger.withFields({ eventName }).debug('Sending event to client')
            // FromCoreEvent keys are a superset of WsEventToClient keys; we assert compatibility here.
            const message = {
              type: eventName as unknown as WsMessageToClient['type'],
              data: payload,
            } as WsMessageToClient
            sendWsEvent(message)
          }

          ctx.emitter.on(eventName, fn as (...args: unknown[]) => void)
        }
      }
      else {
        logger.withFields({ event, data }).debug('Emit event to core')
        ctx.emitter.emit(event, deepClone(data) as CoreEventData<keyof ToCoreEvent>)
      }
    }
    catch (error) {
      logger.withError(error).error('Failed to send event to core')
    }
  }

  async function init() {
    if (isInitialized.value) {
      logger.debug('Core bridge already initialized, skipping')
      return
    }

    logger.verbose('Initializing core bridge')

    config.value.api.telegram.apiId ||= import.meta.env.VITE_TELEGRAM_API_ID || import.meta.env.VITE_TELEGRAM_APP_ID
    config.value.api.telegram.apiHash ||= import.meta.env.VITE_TELEGRAM_API_HASH || import.meta.env.VITE_TELEGRAM_APP_HASH

    logger.withFields({ config: config.value }).verbose('Initialized config')

    const db = await initDB(logger, config.value)

    // Wire up Vue DevTools plugin if the shell has registered a setup
    // callback via provide/inject (dev-only).
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const setupDevtools = useSetupPGliteDevtools()
      setupDevtools?.(db.pglite)
    }

    ensureSessionInvariants()

    // Register event handlers once per CoreBridge lifecycle; each handler
    // will register itself with core via server:event:register when needed.
    registerAllEventHandlers(registerEventHandler)

    // Emit an initial server:connected event so the UI knows core-bridge
    // mode is available, mirroring websocket adapter behavior.
    sendWsEvent({ type: 'server:connected', data: { sessionId: activeSessionId.value, accountReady: false } })

    isInitialized.value = true
  }

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    logger.withFields({ event }).debug('Waiting for event from core')

    return new Promise<WsEventToClientData<T>>((resolve) => {
      enqueueEventHandler(eventHandlersQueue, event, (data: WsEventToClientData<T>) => {
        resolve(deepClone(data) as WsEventToClientData<T>)
      })
    })
  }

  /**
   * Send event to bridge
   */
  function sendWsEvent(event: WsMessageToClient) {
    logger.withFields({ event }).debug('Event send to bridge')

    if (eventHandlers.has(event.type)) {
      const fn = eventHandlers.get(event.type)
      try {
        fn?.(deepClone(event.data) as WsEventToClientData<keyof WsEventToClient>)
      }
      catch (error) {
        logger.withError(error).error('Failed to handle event')
      }
    }

    if (eventHandlersQueue.has(event.type)) {
      drainEventQueue(
        eventHandlersQueue,
        event.type as keyof WsEventToClient,
        deepClone(event.data) as WsEventToClientData<keyof WsEventToClient>,
        (error) => {
          logger.withError(error).error('Failed to handle queued event')
        },
      )
    }
  }

  return {
    init,

    sessions: storageSessions,
    activeSessionId,
    getActiveSession,
    updateActiveSessionMetadata,
    updateSessionMetadataById,
    switchAccount,
    addNewAccount,
    applySessionUpdate,
    logoutCurrentAccount,
    cleanup: resetSessions,

    sendEvent,
    waitForEvent,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCoreBridgeStore, import.meta.hot))
}
