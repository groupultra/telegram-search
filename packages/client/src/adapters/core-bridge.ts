import type { Config } from '@tg-search/common'
import type { ExtractData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'

import { useLogger } from '@guiiai/logg'
import { deepClone, generateDefaultConfig } from '@tg-search/common'
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

  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)

  // React to session switches: Destroy old context, create new one
  watch(activeSessionId, (newId, oldId) => {
    if (!oldId || newId === oldId)
      return

    logger.withFields({ oldId, newId }).debug('Active session changed, destroying CoreContext')
    const nextGeneration = ++generation
    switching = true
    transition = transition.then(async () => {
      await application.reset()
      await coreRuntime.destroy()
      if (disposed || nextGeneration !== generation)
        return
      // Re-register handlers for the new context
      registerAllEventHandlers(registerEventHandler)
      switching = false
      sendWsEvent({ type: 'server:connected', data: { sessionId: newId || '', accountReady: false } })
    }).catch((error) => {
      logger.withError(error).error('Failed to destroy CoreContext on account switch')
    })
  }, { flush: 'sync' })

  onScopeDispose(() => {
    disposed = true
    generation++
    transition = transition.then(async () => {
      await application.dispose()
      await coreRuntime.destroy()
    }).catch(error => logger.withError(error).error('Failed to dispose CoreContext'))
  })

  function ensureCtx() {
    return coreRuntime.getCtx()
  }

  function sendEvent<T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) {
    if (disposed || (switching && event !== 'server:event:register'))
      throw new Error('Core account is switching or disposed')
    const ctx = ensureCtx()!
    logger.withFields({ event, data }).debug('Receive event from client')

    try {
      if (event === 'server:event:register') {
        data = data as WsEventToServerData<'server:event:register'>
        const eventName = data.event as keyof FromCoreEvent
        const eventGeneration = generation

        if (!eventName.startsWith('server:')) {
          const fn = (payload: WsEventToClientData<keyof FromCoreEvent>) => {
            if (disposed || eventGeneration !== generation)
              return
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

  function waitForEvent<T extends keyof WsEventToClient>(
    event: T,
    predicate?: (data: WsEventToClientData<T>) => boolean,
  ) {
    logger.withFields({ event }).debug('Waiting for event from core')
    return new Promise<WsEventToClientData<T>>((resolve) => {
      enqueueEventHandler(eventHandlersQueue, event, (data: WsEventToClientData<T>) => {
        resolve(deepClone(data) as WsEventToClientData<T>)
      }, predicate)
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
    application,
    init,
    sendEvent,
    waitForEvent,
  }
}

export const useCoreBridgeAdapter = defineStore('core-bridge-adapter', () => createCoreBridgeAdapter())

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCoreBridgeAdapter, import.meta.hot))
}
