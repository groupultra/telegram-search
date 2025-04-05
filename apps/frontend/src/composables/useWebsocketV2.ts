import type { WsEventToServer, WsMessageToClient } from '@tg-search/server'

import { useWebSocket } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { WS_API_BASE } from '../constants'
import { useConnectionStore } from './useConnection'

export function createWebsocketV2Context() {
  const socket = useWebSocket<string>(WS_API_BASE)
  const connectionStore = useConnectionStore()
  const { activeSessionId } = storeToRefs(useConnectionStore())

  function createWsMessage<T extends keyof WsEventToServer>(
    type: T,
    payload: Parameters<WsEventToServer[T]>[0],
  ): Extract<WsMessageToClient, { type: T }> {
    return { type, payload } as Extract<WsMessageToClient, { type: T }>
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  function sendEvent<T extends keyof WsEventToServer>(event: T, payload: Parameters<WsEventToServer[T]>[0]) {
    socket.send(JSON.stringify(createWsMessage(event, payload)))
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L95-L123
  watch(socket.data, (rawMessage) => {
    if (!rawMessage)
      return

    try {
      const message = JSON.parse(rawMessage)

      switch (message.type) {
        case 'server:connected':
          // eslint-disable-next-line no-console
          console.log('[WebSocket] Connected', message.data)
          connectionStore.setConnection(message.data.sessionId, { sendEvent })
          activeSessionId.value = message.data.sessionId
          break

        case 'auth:needCode':
          connectionStore.useAuth().needCode.value = true
          break

        case 'auth:needPassword':
          connectionStore.useAuth().needPassword.value = true
          break

        default:
          // eslint-disable-next-line no-console
          console.log('[WebSocket] Message received', message)
      }
    }
    catch {
      console.error('[WebSocket] Invalid message', rawMessage)
    }
  })

  return {
    sendEvent,
  }
}
