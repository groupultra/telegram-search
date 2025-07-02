import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient, WsMessageToServer } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { SessionContext } from './useAuth'

import { useLocalStorage, useWebSocket } from '@vueuse/core'
import { defu } from 'defu'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

import { WS_API_BASE } from '../../constants'
import { getRegisterEventHandler, registerAllEventHandlers } from '../event-handlers'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export const useWebsocketStore = defineStore('websocket', () => {
  const storageSessions = useLocalStorage('websocket/sessions', new Map<string, SessionContext>())
  const storageActiveSessionId = useLocalStorage('websocket/active-session-id', uuidv4())

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

  const wsUrlComputed = computed(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}${WS_API_BASE}?sessionId=${storageActiveSessionId.value}`
  })

  const wsSocket = ref(useWebSocket<keyof WsMessageToClient>(wsUrlComputed.value, {
    onDisconnected: () => {
      // eslint-disable-next-line no-console
      console.log('[WebSocket] Disconnected')
    },
  }))

  const createWsMessage: ClientCreateWsMessageFn = (type, data) => {
    return { type, data } as WsMessageToServer
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  const sendEvent: ClientSendEventFn = (event, data) => {
    if (event !== 'server:event:register')
      // eslint-disable-next-line no-console
      console.log('[WebSocket] Sending event', event, data)

    wsSocket.value!.send(JSON.stringify(createWsMessage(event, data)))
  }

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)
  registerAllEventHandlers(registerEventHandler)

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    // eslint-disable-next-line no-console
    console.log('[WebSocket] Waiting for event', event)

    return new Promise((resolve) => {
      const handlers = eventHandlersQueue.get(event) ?? []
      handlers.push((data) => {
        // eslint-disable-next-line no-console
        console.log('[WebSocket] Resolving event', event, data)

        resolve(data)
      })
      eventHandlersQueue.set(event, handlers)
    }) satisfies Promise<WsEventToClientData<T>>
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L95-L123
  watch(() => wsSocket.value.data, (rawMessage) => {
    if (!rawMessage)
      return

    try {
      const message = JSON.parse(rawMessage) as WsMessageToClient

      if (eventHandlers.has(message.type)) {
      // eslint-disable-next-line no-console
        console.log('[WebSocket] Message received', message)
      }

      if (eventHandlers.has(message.type)) {
        const fn = eventHandlers.get(message.type)

        try {
          if (fn)
            fn(message.data)
        }
        catch (error) {
          console.error('[WebSocket] Error handling event', message, error)
        }
      }

      if (eventHandlersQueue.has(message.type)) {
        const fnQueue = eventHandlersQueue.get(message.type) ?? []

        try {
          fnQueue.forEach((inQueueFn) => {
            inQueueFn(message.data)
            fnQueue.pop()
          })
        }
        catch (error) {
          console.error('[WebSocket] Error handling queued event', message, error)
        }
      }
    }
    catch (error) {
      console.error('[WebSocket] Invalid message', rawMessage, error)
    }
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
