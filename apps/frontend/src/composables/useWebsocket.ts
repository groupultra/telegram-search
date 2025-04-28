import type { WsEventToServer, WsEventToServerData, WsMessageToClient, WsMessageToServer } from '@tg-search/server'
import type { ClientEventHandlerMap } from '../event-handlers'

import { useWebSocket } from '@vueuse/core'
import { watch } from 'vue'

import { WS_API_BASE } from '../constants'
import { getRegisterEventHandler, registerAllEventHandlers } from '../event-handlers'

let wsContext: ReturnType<typeof createWebsocketV2Context>

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export function createWebsocketV2Context(sessionId: string) {
  if (!sessionId)
    throw new Error('Session ID is required')

  const url = `${WS_API_BASE}?sessionId=${sessionId}`
  const socket = useWebSocket<keyof WsMessageToClient>(url.toString())

  const createWsMessage: ClientCreateWsMessageFn = (type, data) => {
    return { type, data } as WsMessageToServer
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  const sendEvent: ClientSendEventFn = (event, data) => {
    if (event !== 'server:event:register')
      // eslint-disable-next-line no-console
      console.log('[WebSocket] Sending event', event, data)

    socket.send(JSON.stringify(createWsMessage(event, data)))
  }

  const eventHandlers: ClientEventHandlerMap = new Map()
  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)
  registerAllEventHandlers(registerEventHandler)

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L95-L123
  watch(socket.data, (rawMessage) => {
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
      else {
        console.error('[WebSocket] Unknown event', message)
      }
    }
    catch (error) {
      console.error('[WebSocket] Invalid message', rawMessage, error)
    }
  })

  return {
    sendEvent,
  }
}

export function useWebsocket(sessionId: string) {
  if (!wsContext)
    wsContext = createWebsocketV2Context(sessionId)

  return wsContext
}
