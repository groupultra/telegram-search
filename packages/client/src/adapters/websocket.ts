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
import { drainEventQueue, enqueueEventHandler } from '../utils/event-queue'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export const useWebsocketStore = defineStore('websocket', () => {
  const storageSessions = useLocalStorage<StoredSession[]>('websocket/sessions', [])
  // active-session-slot: index into storageSessions array
  const storageActiveSessionSlot = useLocalStorage<number>('websocket/active-session-slot', 0)
  const logger = useLogger('WebSocket')
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

  /**
   * Update metadata for the active session slot by shallow-merging the patch.
   * We intentionally keep this focused on the active slot to avoid the
   * previous "upsert by id" behavior, which made the control flow hard to
   * reason about.
   */
  const updateActiveSessionMetadata = (patch: Partial<SessionContext>) => {
    const index = storageActiveSessionSlot.value
    const existing = storageSessions.value[index]
    if (!existing)
      return

    const mergedMetadata = defu({}, patch, existing.metadata ?? {}) as SessionContext

    const sessionsCopy = [...storageSessions.value]
    sessionsCopy[index] = {
      ...existing,
      metadata: mergedMetadata,
    }
    storageSessions.value = sessionsCopy
  }

  /**
   * Update metadata for a specific session identified by its uuid.
   * Unlike the old implementation, this will NOT create new slots; if the
   * session is not found, it simply does nothing.
   */
  const updateSessionMetadataById = (sessionId: string, patch: Partial<SessionContext>) => {
    if (!sessionId)
      return

    const index = storageSessions.value.findIndex(session => session.uuid === sessionId)
    if (index === -1)
      return

    const existing = storageSessions.value[index]
    const mergedMetadata = defu({}, patch, existing.metadata ?? {}) as SessionContext

    const sessionsCopy = [...storageSessions.value]
    sessionsCopy[index] = {
      ...existing,
      metadata: mergedMetadata,
    }
    storageSessions.value = sessionsCopy
  }

  const cleanup = () => {
    storageSessions.value = []
    storageActiveSessionSlot.value = 0
  }

  const wsUrlComputed = computed(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const sessionId = activeSessionId.value
    return `${protocol}//${host}${WS_API_BASE}?sessionId=${sessionId}`
  })

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const isInitialized = ref(false)

  let wsSocket: ReturnType<typeof useWebSocket<keyof WsMessageToClient>>

  const createWsMessage: ClientCreateWsMessageFn = (type, data) => {
    return { type, data } as WsMessageToServer
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  function sendEvent<T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) {
    if (event !== 'server:event:register')
      logger.debug('Sending event', event, data)

    if (!wsSocket)
      return

    wsSocket.send(JSON.stringify(createWsMessage(event, data)))
  }

  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)

  function handleWsConnected() {
    logger.log('Connected')
    /**
     * Each WebSocket connection (and reconnection) needs to inform the
     * server which events it is interested in. We simply re-register all
     * handlers here; the server-side implementation deduplicates listeners
     * per account, so this does not leak.
     */
    registerAllEventHandlers(registerEventHandler)
  }

  wsSocket = useWebSocket<keyof WsMessageToClient>(wsUrlComputed, {
    onConnected: handleWsConnected,
    onDisconnected: () => {
      logger.log('Disconnected')
    },
  })

  const switchAccount = (sessionId: string) => {
    const index = storageSessions.value.findIndex(session => session.uuid === sessionId)
    if (index !== -1) {
      storageActiveSessionSlot.value = index
      logger.withFields({ sessionId }).log('Switched to account')
      // WebSocket will reconnect with the new sessionId in URL
      wsSocket.close()
    }
  }

  const addNewAccount = () => {
    // Create a brand new slot immediately and switch to it.
    const newId = uuidv4()
    const sessionsCopy = [...storageSessions.value, {
      uuid: newId,
      metadata: {},
    } satisfies StoredSession]

    storageSessions.value = sessionsCopy
    storageActiveSessionSlot.value = sessionsCopy.length - 1

    return newId
  }

  /**
   * Apply session:update to the current active account.
   *
   * We deliberately keep this simple: whoever initiated the login flow is
   * responsible for selecting the correct active slot beforehand.
   */
  const applySessionUpdate = (session: string) => {
    updateActiveSessionMetadata({ session })
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

  function init() {
    if (isInitialized.value) {
      logger.log('Already initialized, skipping')
      return
    }

    ensureSessionInvariants()
    isInitialized.value = true
  }

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    logger.log('Waiting for event', event)

    return new Promise<WsEventToClientData<T>>((resolve) => {
      enqueueEventHandler(eventHandlersQueue, event, (data: WsEventToClientData<T>) => {
        logger.log('Resolving event', event, data)
        resolve(data)
      })
    })
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L95-L123
  watch(wsSocket.data, (rawMessage) => {
    if (!rawMessage)
      return

    try {
      const message = JSON.parse(rawMessage) as WsMessageToClient

      if (eventHandlers.has(message.type)) {
        logger.debug('Message received', message)
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
        drainEventQueue(
          eventHandlersQueue,
          message.type,
          message.data,
          (error) => {
            logger.withError(error).withFields({ message: message || 'unknown' }).error('Error handling queued event')
          },
        )
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
    updateActiveSessionMetadata,
    updateSessionMetadataById,
    switchAccount,
    addNewAccount,
    applySessionUpdate,
    logoutCurrentAccount,
    cleanup,

    sendEvent,
    waitForEvent,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebsocketStore, import.meta.hot))
}
