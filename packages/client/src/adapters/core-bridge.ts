import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { WsEventToClient, WsEventToClientData, WsMessageToClient, WsMessageToServer } from '@tg-search/server/types'

import type { ClientSendEventFn } from '../composables/useBridge'
import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { SessionContext } from '../stores/useAuth'

import { useConfig } from '@tg-search/common'
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

  // to core
  const sendEvent: ClientSendEventFn = (event, data) => {
    const ctx = ensureCtx()

    logger.withFields({ event, data }).debug('Receive event from client')

    try {
      if (event === 'server:event:register') {
        if (!event.startsWith('server:')) {
          const eventName = event as keyof FromCoreEvent
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

      switch (event) {
        case 'auth:login':
          ctx.emitter.once('auth:connected', () => {})
          break
        case 'auth:logout':
          ctx.emitter.once('auth:logout', () => {})
          break
      }
    }
    catch (error) {
      logger.withError(error).error('Failed to send event to core')
    }
  }

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)

  function init() {
    registerAllEventHandlers(registerEventHandler)
    sendWsEvent({ type: 'server:connected', data: { sessionId: storageActiveSessionId.value, connected: false } })
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

  // to bridge
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
      const fnQueue = eventHandlersQueue.get(event.type)
      try {
        fnQueue?.[0]?.(event.data)
        fnQueue?.shift()
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

    // WebSocket
    sendEvent,
    waitForEvent,
  }
})
