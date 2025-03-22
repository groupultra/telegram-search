import type { WsEvent, WsEventData } from '@tg-search/server'

import { useWebSocket } from '@vueuse/core'

const WS_API_BASE = 'http://localhost:3000/ws'

export function createWebsocketV2Context() {
  const socket = useWebSocket<{
    type: WsEvent
    data: WsEventData<keyof WsEvent>
  }>(WS_API_BASE, {
    onConnected: () => {
      console.warn('[WebSocket] Connection established')
    },
    onMessage: (event) => {
      console.warn('[WebSocket] Message received', event)
    },
    onDisconnected: () => {
      console.warn('[WebSocket] Connection closed')
    },
  })

  return {
    socket,
  }
}
