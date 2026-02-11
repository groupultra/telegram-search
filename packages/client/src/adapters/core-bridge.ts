import type { Config } from '@tg-search/common'
import type { ExtractData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'

import { useLogger } from '@guiiai/logg'
import { deepClone, generateDefaultConfig } from '@tg-search/common'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { ref, watch } from 'vue'

import { DEV_MODE, IS_CORE_MODE, TELEGRAM_APP_HASH, TELEGRAM_APP_ID } from '../constants'
import { useSetupPGliteDevtools } from '../devtools/pglite-devtools'
import { getRegisterEventHandler } from '../event-handlers'
import { registerAllEventHandlers } from '../event-handlers/register'
import { useSessionStore } from '../stores/useSession'
import { drainEventQueue, enqueueEventHandler } from '../utils/event-queue'
import { initDB } from './core-db'
import { createCoreRuntime } from './core-runtime'

export const useCoreBridgeAdapter = defineStore('core-bridge-adapter', () => {
  const sessionStore = useSessionStore()
  const { activeSessionId } = storeToRefs(sessionStore)
  const logger = useLogger('CoreBridge')

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const isInitialized = ref(false)
  const config = useLocalStorage<Config>('core-bridge/config', generateDefaultConfig())
  const coreRuntime = createCoreRuntime(config, logger)

  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)

  // React to session switches: Destroy old context, create new one
  watch(activeSessionId, (newId, oldId) => {
    if (!oldId || newId === oldId)
      return

    logger.withFields({ oldId, newId }).debug('Active session changed, destroying CoreContext')
    coreRuntime.destroy().then(() => {
      // Re-register handlers for the new context
      registerAllEventHandlers(registerEventHandler)
    }).catch((error) => {
      logger.withError(error).error('Failed to destroy CoreContext on account switch')
    })
  })

  function ensureCtx() {
    return coreRuntime.getCtx()
  }

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
        ctx.emitter.emit(event, deepClone(data) as ExtractData<keyof ToCoreEvent>)
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

    // Initial connection event
    sendWsEvent({ type: 'server:connected', data: { sessionId: activeSessionId.value || '', accountReady: false } })
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

  function sendWsEvent(event: WsMessageToClient) {
    logger.withFields({ event }).debug('Event send to bridge')
    if (eventHandlers.has(event.type)) {
      try {
        const fn = eventHandlers.get(event.type)
        if (fn)
          fn(deepClone(event.data) as any)
      }
      catch (error) { logger.withError(error).error('Failed to handle event') }
    }
    if (eventHandlersQueue.has(event.type)) {
      drainEventQueue(eventHandlersQueue, event.type as any, deepClone(event.data) as any, (error) => {
        logger.withError(error).error('Failed to handle queued event')
      })
    }
  }

  return {
    init,
    sendEvent,
    waitForEvent,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCoreBridgeAdapter, import.meta.hot))
}
