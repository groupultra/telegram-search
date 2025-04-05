import type { WsEventToClient, WsMessageToClient } from '@tg-search/server'

import { useWebSocket } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { WS_API_BASE } from '../constants'
import { useConnectionStore } from './useConnection'

export function createWebsocketV2Context() {
  const socket = useWebSocket<WsMessageToClient>(WS_API_BASE)
  const connectionStore = useConnectionStore()
  const { activeSessionId } = storeToRefs(useConnectionStore())

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  function sendEvent<T extends WsEventToClient>(payload: T) {
    socket.send(JSON.stringify(payload))
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L95-L123
  watch(socket.data, (message) => {
    if (!message)
      return

    switch (message.type) {
      case 'server:connected':
        // eslint-disable-next-line no-console
        console.log('[WebSocket] Connected', message.data)
        connectionStore.setConnection(message.data.sessionId, { sendEvent })
        activeSessionId.value = message.data.sessionId
        break
      default:
        // eslint-disable-next-line no-console
        console.log('[WebSocket] Message received', message)
    }
  })

  return {
    sendEvent,
  }
}
