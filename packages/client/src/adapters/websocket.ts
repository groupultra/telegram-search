import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient, WsMessageToServer } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { SessionContext } from '../stores/useAuth'

import { useLogger } from '@guiiai/logg'
import { useLocalStorage, useWebSocket } from '@vueuse/core'
import { defu } from 'defu'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

import { WS_API_BASE } from '../../constants'
import { getRegisterEventHandler, registerAllEventHandlers } from '../event-handlers'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export const useWebsocketStore = defineStore('websocket', () => {
  const storageSessions = useLocalStorage<Record<string, SessionContext>>('websocket/sessions', {})
  const storageActiveSessionId = useLocalStorage<string>('websocket/active-session-id', '')
  const logger = useLogger('WebSocket')

  const getActiveSession = () => {
    if (!storageActiveSessionId.value) {
      return undefined
    }
    return storageSessions.value[storageActiveSessionId.value]
  }

  const updateActiveSession = (sessionId: string, partialSession: Partial<SessionContext>) => {
    const existingSession = storageSessions.value[sessionId] || {}
    const mergedSession = defu({}, partialSession, existingSession)

    storageSessions.value = {
      ...storageSessions.value,
      [sessionId]: mergedSession,
    }
    storageActiveSessionId.value = sessionId
  }

  const switchAccount = (sessionId: string) => {
    if (storageSessions.value[sessionId]) {
      storageActiveSessionId.value = sessionId
      logger.withFields({ sessionId }).log('Switched to account')
      // WebSocket will reconnect with the new sessionId in URL
      wsSocket.value.close()
    }
  }

  const addNewAccount = () => {
    const newSessionId = uuidv4()
    storageActiveSessionId.value = newSessionId
    storageSessions.value = {
      ...storageSessions.value,
      [newSessionId]: {},
    }
    // WebSocket will reconnect with the new sessionId in URL
    wsSocket.value.close()
    return newSessionId
  }

  const logoutCurrentAccount = async () => {
    const currentSessionId = storageActiveSessionId.value
    if (!currentSessionId) {
      return
    }

    const session = storageSessions.value[currentSessionId]
    if (session) {
      // Remove session from storage
      const newSessions = { ...storageSessions.value }
      delete newSessions[currentSessionId]
      storageSessions.value = newSessions

      // Switch to another account or create new empty session
      const remainingSessions = Object.keys(newSessions)
      if (remainingSessions.length > 0) {
        storageActiveSessionId.value = remainingSessions[0]
      }
      else {
        storageActiveSessionId.value = ''
      }

      // Emit logout event
      sendEvent('auth:logout', undefined)
    }
  }

  const cleanup = () => {
    storageSessions.value = {}
    storageActiveSessionId.value = ''
  }

  const getAllSessions = () => {
    return Object.entries(storageSessions.value).map(([id, session]) => ({
      id,
      ...session,
    }))
  }

  const wsUrlComputed = computed(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}${WS_API_BASE}?sessionId=${storageActiveSessionId.value}`
  })

  const wsSocket = ref(useWebSocket<keyof WsMessageToClient>(wsUrlComputed, {
    onDisconnected: () => {
      logger.log('Disconnected')
    },
  }))

  const createWsMessage: ClientCreateWsMessageFn = (type, data) => {
    return { type, data } as WsMessageToServer
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  const sendEvent: ClientSendEventFn = (event, data) => {
    if (event !== 'server:event:register')
      logger.log('Sending event', event, data)

    wsSocket.value!.send(JSON.stringify(createWsMessage(event, data)))
  }

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)
  const isInitialized = ref(false)

  function init() {
    if (isInitialized.value) {
      logger.log('Already initialized, skipping')
      return
    }

    // Ensure there's at least one session
    if (!storageActiveSessionId.value || Object.keys(storageSessions.value).length === 0) {
      const newSessionId = uuidv4()
      storageActiveSessionId.value = newSessionId
      storageSessions.value = {
        [newSessionId]: {},
      }
    }

    registerAllEventHandlers(registerEventHandler)
    isInitialized.value = true
  }

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    logger.log('Waiting for event', event)

    return new Promise((resolve) => {
      const handlers = eventHandlersQueue.get(event) ?? []
      handlers.push((data) => {
        logger.log('Resolving event', event, data)

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
        logger.log('Message received', message)
      }

      if (eventHandlers.has(message.type)) {
        const fn = eventHandlers.get(message.type)

        try {
          if (fn)
            fn(message.data)
        }
        catch (error) {
          logger.withError(error).withFields({ message: message || 'unknown' }).error('Error handling event')
        }
      }

      if (eventHandlersQueue.has(message.type)) {
        const fnQueue = eventHandlersQueue.get(message.type) ?? []

        try {
          fnQueue.forEach((inQueueFn) => {
            inQueueFn(message.data)
            fnQueue.shift()
          })
        }
        catch (error) {
          logger.withError(error).withFields({ message: message || 'unknown' }).error('Error handling queued event')
        }
      }
    }
    catch (error) {
      logger.error('Invalid message', rawMessage, error)
    }
  })

  return {
    init,

    sessions: storageSessions,
    activeSessionId: storageActiveSessionId,
    getActiveSession,
    updateActiveSession,
    switchAccount,
    addNewAccount,
    logoutCurrentAccount,
    getAllSessions,
    cleanup,

    sendEvent,
    waitForEvent,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebsocketStore, import.meta.hot))
}
