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
import { CoreEventType } from '@tg-search/core'
import { useWebSocket } from '@vueuse/core'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'

import { WS_API_BASE } from '../constants'
import { getRegisterEventHandler } from '../event-handlers'
import { registerAllEventHandlers } from '../event-handlers/register'
import { useAccountStore } from '../stores/useAccount'
import { useSessionStore } from '../stores/useSession'
import { drainEventQueue, enqueueEventHandler } from '../utils/event-queue'
import { createWebSocketApplicationBridge } from './eventa-websocket'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

// Renamed to 'adapter' to signify it's not the main store anymore
export const useWebsocketAdapter = defineStore('websocket-adapter', () => {
  const sessionStore = useSessionStore()
  const { activeSessionId } = storeToRefs(sessionStore)
  const logger = useLogger('WebSocket')

  const wsUrlComputed = computed(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const sessionId = activeSessionId.value
    // Don't connect if no session ID
    if (!sessionId)
      return undefined
    return `${protocol}//${host}${WS_API_BASE}?sessionId=${sessionId}`
  })

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()

  // Explicit type to allow undefined URL to pause connection
  let wsSocket: ReturnType<typeof useWebSocket<keyof WsMessageToClient>>
  let pendingQrLogin: { attemptId: string, message: WsMessageToServer } | undefined

  const createWsMessage: ClientCreateWsMessageFn = (type, data) => {
    return { type, data } as WsMessageToServer
  }

  function sendEvent<T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) {
    if (event !== 'server:event:register')
      logger.debug('Sending event', event)

    const message = createWsMessage(event, data)
    if (message.type === CoreEventType.AuthQrCancel && message.data.attemptId === pendingQrLogin?.attemptId) {
      pendingQrLogin = undefined
      return
    }
    if (message.type === CoreEventType.AuthLogin && message.data.qrAttemptId && wsSocket.status.value !== 'OPEN') {
      pendingQrLogin = { attemptId: message.data.qrAttemptId, message }
      if (wsSocket.status.value !== 'CONNECTING')
        wsSocket.open()
      return
    }
    wsSocket.send(JSON.stringify(message))
  }

  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)

  function handleWsConnected() {
    logger.log('Connected')
    registerAllEventHandlers(registerEventHandler)
    if (pendingQrLogin) {
      const { message } = pendingQrLogin
      pendingQrLogin = undefined
      wsSocket.send(JSON.stringify(message))
    }
  }

  // useWebSocket automatically handles reconnection when url changes
  wsSocket = useWebSocket<keyof WsMessageToClient>(wsUrlComputed, {
    onConnected: handleWsConnected,
    onDisconnected: () => {
      logger.log('Disconnected')
      const qrLogin = useAccountStore().qrLogin
      if (qrLogin.state.attemptId)
        qrLogin.receiveState({ attemptId: qrLogin.state.attemptId, status: 'error' })
      toast.error('WebSocket disconnected')
    },
    // Only connect when URL is defined
    immediate: !!wsUrlComputed.value,
  })
  const application = createWebSocketApplicationBridge(() => wsSocket.ws.value)

  // Explicitly watch URL to open/close if it transitions between undefined/defined
  watch(wsUrlComputed, (url) => {
    if (url) {
      // useWebSocket might not auto-open if it started as undefined
      wsSocket.open()
    }
    else {
      wsSocket.close()
    }
  })

  async function init() {
    logger.verbose('Initializing websocket adapter')
    return new Promise<void>((resolve) => {
      waitForEvent('server:connected').then(() => resolve())
    })
  }

  function waitForEvent<T extends keyof WsEventToClient>(
    event: T,
    predicate?: (data: WsEventToClientData<T>) => boolean,
  ) {
    logger.withFields({ event }).debug('Waiting for event')
    return new Promise<WsEventToClientData<T>>((resolve) => {
      enqueueEventHandler(eventHandlersQueue, event, (data: WsEventToClientData<T>) => {
        logger.withFields({ event }).debug('Resolving event')
        resolve(data)
      }, predicate)
    })
  }

  watch(wsSocket.data, (rawMessage) => {
    if (!rawMessage)
      return
    try {
      const message = JSON.parse(rawMessage) as WsMessageToClient
      if (eventHandlers.has(message.type)) {
        logger.debug('Message received', message.type)
      }
      if (eventHandlers.has(message.type)) {
        const fn = eventHandlers.get(message.type)
        try {
          if (fn)
            fn(message.data)
        }
        catch (error) {
          logger.withError(error).withFields({ type: message.type }).error('Error handling event')
        }
      }
      if (eventHandlersQueue.has(message.type)) {
        drainEventQueue(eventHandlersQueue, message.type, message.data, (error) => {
          logger.withError(error).withFields({ type: message.type }).error('Error handling queued event')
        })
      }
    }
    catch (error) {
      logger.withError(error).error('Invalid message')
    }
  })

  return {
    application,
    init,
    sendEvent,
    waitForEvent,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebsocketAdapter, import.meta.hot))
}
