import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { SessionContext } from '../stores/useAuth'

import { initLogger, LoggerFormat, LoggerLevel, useLogger } from '@guiiai/logg'
import { initConfig, useConfig } from '@tg-search/common'
import { createCoreInstance, initDrizzle } from '@tg-search/core'
import { useLocalStorage } from '@vueuse/core'
import defu from 'defu'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'

import { getRegisterEventHandler, registerAllEventHandlers } from '../event-handlers'

export const useCoreBridgeStore = defineStore('core-bridge', () => {
  const storageSessions = useLocalStorage('core-bridge/sessions', new Map<string, SessionContext>())
  const storageActiveSessionId = useLocalStorage('core-bridge/active-session-id', uuidv4())

  const logger = useLogger('CoreBridge')
  let ctx: CoreContext

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)
  const isInitialized = ref(false)

  function deepClone<T>(data?: T): T | undefined {
    if (!data)
      return data

    try {
      return JSON.parse(JSON.stringify(data)) as T
    }
    catch (error) {
      logger.withError(error).error('Failed to deep clone data')
      return data
    }
  }

  function ensureCtx() {
    if (!ctx) {
      // TODO: use flags
      const isDebug = !!import.meta.env.VITE_DEBUG
      initLogger(isDebug ? LoggerLevel.Debug : LoggerLevel.Verbose, LoggerFormat.Pretty)

      try {
        const config = useConfig()
        config.api.telegram.apiId ||= import.meta.env.VITE_TELEGRAM_APP_ID
        config.api.telegram.apiHash ||= import.meta.env.VITE_TELEGRAM_APP_HASH

        ctx = createCoreInstance(config)
        initDrizzle(logger, config, {
          debuggerWebSocketUrl: import.meta.env.VITE_DB_DEBUGGER_WS_URL as string,
          isDatabaseDebugMode: import.meta.env.VITE_DB_DEBUG === 'true',
        })
      }
      catch (error) {
        console.error(error)
        initConfig()
      }
    }

    return ctx
  }

  const getActiveSession = () => {
    return storageSessions.value.get(storageActiveSessionId.value)
  }

  const updateActiveSession = (sessionId: string, partialSession: Partial<SessionContext>) => {
    const mergedSession = defu({}, partialSession, storageSessions.value.get(sessionId))

    storageSessions.value.set(sessionId, mergedSession)
    storageActiveSessionId.value = sessionId
  }

  const cleanup = () => {
    storageSessions.value.clear()
    storageActiveSessionId.value = uuidv4()
  }

  /**
   * Send event to core
   */
  function sendEvent<T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) {
    const ctx = ensureCtx()
    logger.withFields({ event, data }).debug('Receive event from client')

    try {
      if (event === 'server:event:register') {
        data = data as WsEventToServerData<'server:event:register'>
        const eventName = data.event as keyof FromCoreEvent

        if (!eventName.startsWith('server:')) {
          const fn = (data: WsEventToClientData<keyof FromCoreEvent>) => {
            logger.withFields({ eventName }).debug('Sending event to client')
            sendWsEvent({ type: eventName as any, data })
          }

          ctx.emitter.on(eventName, fn as any)
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

    await initConfig()
    registerAllEventHandlers(registerEventHandler)
    sendWsEvent({ type: 'server:connected', data: { sessionId: storageActiveSessionId.value, connected: false } })
    isInitialized.value = true
  }

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    logger.withFields({ event }).debug('Waiting for event from core')

    return new Promise<WsEventToClientData<T>>((resolve) => {
      const handlers = eventHandlersQueue.get(event) ?? []

      handlers.push((data) => {
        resolve(deepClone(data) as WsEventToClientData<T>)
      })

      eventHandlersQueue.set(event, handlers)
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
      const fnQueue = eventHandlersQueue.get(event.type) ?? []

      try {
        fnQueue.forEach((inQueueFn) => {
          inQueueFn(deepClone(event.data) as WsEventToClientData<keyof WsEventToClient>)
          fnQueue.pop()
        })
      }
      catch (error) {
        logger.withError(error).error('Failed to handle event')
      }
    }
  }

  return {
    init,

    sessions: storageSessions,
    activeSessionId: storageActiveSessionId,
    getActiveSession,
    updateActiveSession,
    cleanup,

    sendEvent,
    waitForEvent,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCoreBridgeStore, import.meta.hot))
}
