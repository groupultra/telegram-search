import type {
  WsEventToClient,
  WsEventToClientData,
  WsEventToServer,
  WsEventToServerData,
  WsMessageToClient,
  WsMessageToServer,
} from '@tg-search/server/types'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'

import { useLogger } from '@guiiai/logg'
import { useWebSocket } from '@vueuse/core'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'

import { WS_API_BASE } from '../../constants'
import { getRegisterEventHandler } from '../event-handlers'
import { registerAllEventHandlers } from '../event-handlers/register'
import { useSessionStore } from '../stores/session'
import { drainEventQueue, enqueueEventHandler } from '../utils/event-queue'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export const useWebsocketStore = defineStore('websocket', () => {
  const sessionStore = useSessionStore()
  const {
    sessions: storageSessions,
    activeSessionSlot: storageActiveSessionSlot,
    activeSession,
  } = storeToRefs(sessionStore)

  const {
    ensureSessionInvariants,
    updateSession,
    addNewAccount,
    removeCurrentAccount,
    cleanup,
  } = sessionStore

  const logger = useLogger('WebSocket')

  ensureSessionInvariants()

  const activeSessionId = computed(() => {
    return activeSession.value?.uuid || uuidv4()
  })

  /**
   * Update metadata for the active session slot by shallow-merging the patch.
   * We intentionally keep this focused on the active slot to avoid the
   * previous "upsert by id" behavior, which made the control flow hard to
   * reason about.
   */
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
      // When switching to an existing account, pessimistically mark its
      // connection state as disconnected. AuthStore's auto-login watcher
      // will see { hasSession, !isConnected } for the new active slot and
      // can drive reconnection logic uniformly across websocket and
      // core-bridge modes.
      updateSession(sessionId, s => ({ ...s, isConnected: false }))

      storageActiveSessionSlot.value = index
      logger.withFields({ sessionId }).log('Switched to account')
      // WebSocket will reconnect with the new sessionId in URL
      wsSocket.close()
    }
  }

  /**
   * Apply session:update to the current active account.
   *
   * We deliberately keep this simple: whoever initiated the login flow is
   * responsible for selecting the correct active slot beforehand.
   */
  const applySessionUpdate = (session: string) => {
    if (activeSession.value) {
      activeSession.value = {
        ...activeSession.value,
        session,
      }
    }
  }

  const logoutCurrentAccount = async () => {
    const removed = removeCurrentAccount()
    if (!removed)
      return

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
    logger.withFields({ event }).debug('Waiting for event')

    return new Promise<WsEventToClientData<T>>((resolve) => {
      enqueueEventHandler(eventHandlersQueue, event, (data: WsEventToClientData<T>) => {
        logger.withFields({ event, data }).debug('Resolving event')
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
    activeSession,
    updateSession,
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
