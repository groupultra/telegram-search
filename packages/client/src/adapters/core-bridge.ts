import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { SessionContext } from '../stores/useAuth'

import { initConfig, useConfig } from '@tg-search/common'
import { createCoreInstance, initDrizzle } from '@tg-search/core'
import { initLogger, useLogger } from '@unbird/logg'
import { useLocalStorage } from '@vueuse/core'
import defu from 'defu'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

import { getRegisterEventHandler, registerAllEventHandlers } from '../event-handlers'

export const useCoreBridgeStore = defineStore('core-bridge', () => {
  const storageSessions = useLocalStorage('core-bridge/sessions', new Map<string, SessionContext>())
  const storageActiveSessionId = useLocalStorage('core-bridge/active-session-id', uuidv4())

  const logger = useLogger('CoreBridge')
  let ctx: CoreContext

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)

  function ensureCtx() {
    if (!ctx) {
      initLogger()

      const config = useConfig()
      config.api.telegram.apiId ||= import.meta.env.VITE_TELEGRAM_APP_ID
      config.api.telegram.apiHash ||= import.meta.env.VITE_TELEGRAM_APP_HASH

      ctx = createCoreInstance(config)
      initDrizzle(logger, config)
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
        ctx.emitter.emit(event, data as CoreEventData<keyof ToCoreEvent>)
      }
    }
    catch (error) {
      logger.withError(error).error('Failed to send event to core')
    }
  }

  function init() {
    initConfig().then(() => {
      registerAllEventHandlers(registerEventHandler)
      sendWsEvent({ type: 'server:connected', data: { sessionId: storageActiveSessionId.value, connected: false } })
    })
  }

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    logger.withFields({ event }).debug('Waiting for event from core')

    return new Promise<WsEventToClientData<T>>((resolve) => {
      const handlers = eventHandlersQueue.get(event) ?? []

      handlers.push((data) => {
        resolve(data)
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
        fn?.(event.data)
      }
      catch (error) {
        logger.withError(error).error('Failed to handle event')
      }
    }

    if (eventHandlersQueue.has(event.type)) {
      const fnQueue = eventHandlersQueue.get(event.type) ?? []

      try {
        fnQueue.forEach((inQueueFn) => {
          inQueueFn(event.data)
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
