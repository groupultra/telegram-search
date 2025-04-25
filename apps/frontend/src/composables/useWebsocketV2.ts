import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToClient } from '@tg-search/server'

import { useWebSocket } from '@vueuse/core'
import { watch } from 'vue'

import { WS_API_BASE } from '../constants'
import { registerAuthEventHandlers } from '../event-handlers/auth'
import { registerEntityEventHandlers } from '../event-handlers/entity'
import { registerServerEventHandlers } from '../event-handlers/server'
import { registerTakeoutEventHandlers } from '../event-handlers/takeout'

let wsContext: ReturnType<typeof createWebsocketV2Context>

export type EventHandler<T extends keyof WsEventToClient> = (data: WsEventToClientData<T>) => void
export type RegisterEventHandler<T extends keyof WsEventToClient> = (event: T, handler: EventHandler<T>) => void

export function createWebsocketV2Context(sessionId: string) {
  if (!sessionId)
    throw new Error('Session ID is required')

  const url = `${WS_API_BASE}?sessionId=${sessionId}`
  const socket = useWebSocket<keyof WsMessageToClient>(url.toString())

  const eventHandlers = new Map<keyof WsEventToClient, EventHandler<keyof WsEventToClient>>()
  const registerEventHandler: RegisterEventHandler<keyof WsEventToClient> = (event, handler) => {
    eventHandlers.set(event, handler)

    sendEvent('server:registerEvent', { event })
  }

  registerServerEventHandlers(registerEventHandler)
  registerAuthEventHandlers(registerEventHandler)
  registerEntityEventHandlers(registerEventHandler)
  registerTakeoutEventHandlers(registerEventHandler)

  function createWsMessage<T extends keyof WsEventToServer>(
    type: T,
    data: WsEventToServerData<T>,
  ): Extract<WsMessageToClient, { type: T }> {
    return { type, data } as Extract<WsMessageToClient, { type: T }>
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  function sendEvent<T extends keyof WsEventToServer>(event: T, data: WsEventToServerData<T>) {
    // eslint-disable-next-line no-console
    console.log('[WebSocket] Sending event', event, data)

    socket.send(JSON.stringify(createWsMessage(event, data)))
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L95-L123
  watch(socket.data, (rawMessage) => {
    if (!rawMessage || typeof rawMessage !== 'string')
      return

    try {
      const message = JSON.parse(rawMessage) as WsMessageToClient

      if (eventHandlers.has(message.type)) {
        // eslint-disable-next-line no-console
        console.log('[WebSocket] Message received', message)
      }

      eventHandlers.get(message.type)?.(message.data)
    }
    catch {
      console.error('[WebSocket] Invalid message', rawMessage)
    }
  })

  return {
    sendEvent,
  }
}

export function useWebsocketV2(sessionId: string) {
  if (!wsContext)
    wsContext = createWebsocketV2Context(sessionId)

  return wsContext
}
