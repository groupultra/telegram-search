import type { UiCommandInput, UiCommandType, UiNotificationData, UiNotificationType } from '@tg-search/core'

import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'

import { useLogger } from '@guiiai/logg'
import { UI_HEARTBEAT_PING, UI_HEARTBEAT_PONG } from '@tg-search/core'
import { useEventListener, useWebSocket } from '@vueuse/core'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { computed, onScopeDispose } from 'vue'
import { toast } from 'vue-sonner'

import { WS_API_BASE } from '../constants'
import { getRegisterEventHandler } from '../event-handlers'
import { registerAllEventHandlers } from '../event-handlers/register'
import { useAccountStore } from '../stores/useAccount'
import { useSessionStore } from '../stores/useSession'
import { drainEventQueue, enqueueEventHandler } from '../utils/event-queue'
import { createWebSocketApplicationBridge } from './eventa-websocket'
import { emitUiCommand, listenUiNotifications } from './ui-eventa'

// Renamed to 'adapter' to signify it's not the main store anymore
export const useWebsocketAdapter = defineStore('websocket-adapter', () => {
  const sessionStore = useSessionStore()
  const { activeSessionId } = storeToRefs(sessionStore)
  const logger = useLogger('WebSocket')
  let disposed = false

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
  const registerEventHandler = getRegisterEventHandler(eventHandlers)

  // Explicit type to allow undefined URL to pause connection
  let wsSocket: ReturnType<typeof useWebSocket<string>>

  const application = createWebSocketApplicationBridge(() => wsSocket.ws.value, {
    onBind: context => listenUiNotifications(context, (type, data) => {
      if (!disposed)
        handleNotification(type, data)
    }),
  })

  function sendEvent<T extends UiCommandType>(event: T, data?: UiCommandInput<T>) {
    logger.debug('Sending event', event, data)
    // getContext throws when the socket is not open, as the legacy send did.
    void emitUiCommand(application.getContext(), event, data)
  }

  function handleWsConnected(socket: WebSocket) {
    logger.log('Connected')
    if (disposed || socket !== wsSocket.ws.value)
      return
    registerAllEventHandlers(registerEventHandler)
    // Bind the Eventa context now: the server sends server:connected as soon
    // as the socket opens, and the listeners must exist before that frame.
    application.getContext()
  }

  // useWebSocket automatically handles reconnection when url changes
  wsSocket = useWebSocket<string>(wsUrlComputed, {
    onConnected: handleWsConnected,
    onDisconnected: (socket) => {
      if (disposed || socket !== wsSocket.ws.value)
        return
      logger.log('Disconnected')
      useAccountStore().resetReady()
      toast.error('WebSocket disconnected')
    },
    autoReconnect: { retries: -1, delay: 2000 },
    heartbeat: {
      message: UI_HEARTBEAT_PING,
      responseMessage: UI_HEARTBEAT_PONG,
      interval: 30000,
      pongTimeout: 10000,
    },
    // Only connect when URL is defined
    immediate: !!wsUrlComputed.value,
  })
  onScopeDispose(() => {
    disposed = true
    void application.dispose?.()
  })

  useEventListener(window, 'online', () => {
    if (wsUrlComputed.value && wsSocket.status.value === 'CLOSED')
      wsSocket.open()
  })

  async function init() {
    logger.verbose('Initializing websocket adapter')
    return new Promise<void>((resolve) => {
      waitForEvent('server:connected').then(() => resolve())
    })
  }

  function waitForEvent<T extends UiNotificationType>(
    event: T,
    predicate?: (data: UiNotificationData<T>) => boolean,
  ) {
    logger.withFields({ event }).debug('Waiting for event')
    return new Promise<UiNotificationData<T>>((resolve) => {
      enqueueEventHandler(eventHandlersQueue, event, (data: UiNotificationData<T>) => {
        logger.withFields({ event, data }).debug('Resolving event')
        resolve(data)
      }, predicate)
    })
  }

  function handleNotification<T extends UiNotificationType>(type: T, data: UiNotificationData<T>) {
    const fn = eventHandlers.get(type)
    if (fn) {
      logger.debug('Message received', type, data)
      try {
        fn(data as UiNotificationData<UiNotificationType>)
      }
      catch (error) {
        logger.withError(error).withFields({ type }).error('Error handling event')
      }
    }
    if (eventHandlersQueue.has(type)) {
      drainEventQueue(eventHandlersQueue, type, data, (error) => {
        logger.withError(error).withFields({ type }).error('Error handling queued event')
      })
    }
  }

  return {
    application,
    init,
    sendEvent,
    waitForEvent,
    requestSignInTicket: () => application.requestSignInTicket(),
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebsocketAdapter, import.meta.hot))
}
