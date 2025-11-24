import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient, WsMessageToServer } from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'
import type { SessionContext, StoredSession } from '../types/session'

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
  const storageSessions = useLocalStorage<StoredSession[]>('websocket/sessions', [])
  // active-session-slot: index into storageSessions array
  const storageActiveSessionSlot = useLocalStorage<number>('websocket/active-session-slot', 0)
  const logger = useLogger('WebSocket')
  /**
   * When adding a new account, we first navigate to the login page and only
   * create/activate a new slot after successful login (session:update).
   * This ref temporarily holds the uuid for the "pending" account.
   */
  const pendingSessionId = ref<string | null>(null)

  const ensureSessionInvariants = () => {
    if (!Array.isArray(storageSessions.value))
      storageSessions.value = []

    if (storageSessions.value.length === 0) {
      storageSessions.value = [{
        uuid: uuidv4(),
        metadata: {},
      }]
      storageActiveSessionSlot.value = 0
      return
    }

    if (storageActiveSessionSlot.value < 0 || storageActiveSessionSlot.value >= storageSessions.value.length)
      storageActiveSessionSlot.value = 0
  }

  ensureSessionInvariants()

  const activeSessionId = computed(() => {
    const slot = storageActiveSessionSlot.value
    const session = storageSessions.value[slot]
    return session?.uuid ?? ''
  })

  const getActiveSession = () => {
    const slot = storageActiveSessionSlot.value
    return storageSessions.value[slot]?.metadata
  }

  const updateActiveSession = (sessionId: string, partialSession: Partial<SessionContext>) => {
    if (!sessionId) {
      // create a fresh uuid when caller does not care about specific id
      sessionId = uuidv4()
    }

    const currentIndex = storageSessions.value.findIndex(session => session.uuid === sessionId)
    const sessionIndex = currentIndex === -1 ? storageSessions.value.length : currentIndex
    const existing = storageSessions.value[sessionIndex]
    const existingMetadata = existing?.metadata ?? {}
    const mergedMetadata = defu({}, partialSession, existingMetadata) as SessionContext

    const updatedSession: StoredSession = {
      uuid: existing?.uuid ?? sessionId,
      sessionString: existing?.sessionString,
      metadata: mergedMetadata,
    }

    const sessionsCopy = [...storageSessions.value]
    sessionsCopy[sessionIndex] = updatedSession
    storageSessions.value = sessionsCopy
    storageActiveSessionSlot.value = sessionIndex
  }

  const cleanup = () => {
    storageSessions.value = []
    storageActiveSessionSlot.value = 0
  }

  const getAllSessions = () => {
    return storageSessions.value.map(session => ({
      id: session.uuid,
      ...session.metadata,
    }))
  }

  const wsUrlComputed = computed(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const sessionId = activeSessionId.value
    return `${protocol}//${host}${WS_API_BASE}?sessionId=${sessionId}`
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

  const switchAccount = (sessionId: string) => {
    const index = storageSessions.value.findIndex(session => session.uuid === sessionId)
    if (index !== -1) {
      storageActiveSessionSlot.value = index
      logger.withFields({ sessionId }).log('Switched to account')
      // WebSocket will reconnect with the new sessionId in URL
      wsSocket.value.close()
    }
  }

  const addNewAccount = () => {
    // Mark that the next successful login should create a brand new slot.
    pendingSessionId.value = uuidv4()
    return pendingSessionId.value
  }

  /**
   * Apply session:update to either the current active account or, when adding
   * a new account, to a freshly created slot identified by pendingSessionId.
   */
  const applySessionUpdate = (session: string) => {
    if (pendingSessionId.value) {
      updateActiveSession(pendingSessionId.value, { session })
      pendingSessionId.value = null
    }
    else {
      updateActiveSession(activeSessionId.value, { session })
    }
  }

  const logoutCurrentAccount = async () => {
    const index = storageActiveSessionSlot.value
    const sessions = storageSessions.value

    if (index < 0 || index >= sessions.length)
      return

    const newSessions = [...sessions.slice(0, index), ...sessions.slice(index + 1)]
    storageSessions.value = newSessions

    if (newSessions.length === 0) {
      storageActiveSessionSlot.value = 0
    }
    else if (index >= newSessions.length) {
      storageActiveSessionSlot.value = newSessions.length - 1
    }
    else {
      storageActiveSessionSlot.value = index
    }

    // Emit logout event for current account
    sendEvent('auth:logout', undefined)
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

    ensureSessionInvariants()

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
    activeSessionId,
    getActiveSession,
    updateActiveSession,
    switchAccount,
    addNewAccount,
    applySessionUpdate,
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
