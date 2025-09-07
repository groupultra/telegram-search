import type { CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { WsEventToClient, WsEventToClientData, WsMessageToClient, WsMessageToServer } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { SessionContext } from '../stores/useAuth'
import type { ClientSendEventFn } from '../stores/useBridge'

import { useConfig } from '@tg-search/common'
import { createCoreInstance, initDrizzle } from '@tg-search/core'
import { useLogger } from '@unbird/logg'
import { useLocalStorage } from '@vueuse/core'
import defu from 'defu'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { onMounted } from 'vue'

import { getRegisterEventHandler, registerAllEventHandlers } from '../event-handlers'

export const useCoreBridgeStore = defineStore('core-bridge', () => {
  const storageSessions = useLocalStorage('websocket/sessions', new Map<string, SessionContext>())
  const storageActiveSessionId = useLocalStorage('websocket/active-session-id', uuidv4())
  const config = useConfig()
  const core = createCoreInstance(config)
  const logger = useLogger('core-bridge')

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
    logger.withFields({ event, data }).log('Receive event from client')
    const event_server = { type: event, data } as unknown as WsMessageToServer
    try {
      if (event_server.type === 'server:event:register') {
        if (!event_server.data.event.startsWith('server:')) {
          const eventName = event_server.data.event as keyof FromCoreEvent
          const fn = (data: WsEventToClientData<keyof FromCoreEvent>) => {
            logger.withFields({ eventName }).log('Sending event to client')
            sendWsEvent({ type: eventName as any, data })
          }
          core.emitter.on(eventName, fn as any)
        }
      }
      else {
        logger.withFields({ event: event_server.type, data: event_server.data }).log('Emit event to core')
        core.emitter.emit(event_server.type, event_server.data as CoreEventData<keyof ToCoreEvent>)
      }

      switch (event_server.type) {
        case 'auth:login':
          logger.log('auth:login')
          core.emitter.once('auth:connected', () => {})
          break
        case 'auth:logout':
          logger.log('auth:logout')
          core.emitter.once('auth:logout', () => {})
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
  registerAllEventHandlers(registerEventHandler)

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    logger.withFields({ event }).log('Waiting for event from core')
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
    logger.withFields({ event: event.type, data: event.data }).log('Event send to bridge')
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

  onMounted(() => {
    initDrizzle(logger, config)
    sendWsEvent({ type: 'server:connected', data: { sessionId: storageActiveSessionId.value, connected: false } })
  })

  return {
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
