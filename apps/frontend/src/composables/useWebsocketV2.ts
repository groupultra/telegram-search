import type { WsEventToServer, WsMessageToClient } from '@tg-search/server'

import { useWebSocket } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

import { WS_API_BASE } from '../constants'
import { useSessionStore } from '../store/useSessionV2'
import { useSyncTaskStore } from '../store/useSyncTask'

let wsContext: ReturnType<typeof createWebsocketV2Context>

// 使用 WsMessageToClient 的类型来定义事件处理器
type WsEventHandler = (message: WsMessageToClient) => void

export function createWebsocketV2Context(sessionId: string) {
  if (!sessionId)
    throw new Error('Session ID is required')

  const url = `${WS_API_BASE}?sessionId=${sessionId}`
  const socket = useWebSocket<keyof WsMessageToClient>(url.toString())
  const connectionStore = useSessionStore()

  function createWsMessage<T extends keyof WsEventToServer>(
    type: T,
    data: Parameters<WsEventToServer[T]>[0],
  ): Extract<WsMessageToClient, { type: T }> {
    return { type, data } as Extract<WsMessageToClient, { type: T }>
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  function sendEvent<T extends keyof WsEventToServer>(event: T, data: Parameters<WsEventToServer[T]>[0]) {
    // eslint-disable-next-line no-console
    console.log('[WebSocket] Sending event', event, data)

    socket.send(JSON.stringify(createWsMessage(event, data)))
  }

  // 修改Map的类型参数，使用WsMessageToClient的type属性作为键
  const eventHandlers = new Map<WsMessageToClient['type'], WsEventHandler>()

  // 更新registerEventHandler函数参数类型
  function registerEventHandler<T extends WsMessageToClient['type']>(event: T, handler: WsEventHandler) {
    eventHandlers.set(event, handler)
  }

  // 更新unregisterEventHandler函数参数类型
  function unregisterEventHandler<T extends WsMessageToClient['type']>(event: T) {
    eventHandlers.delete(event)
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L95-L123
  watch(socket.data, (rawMessage) => {
    if (!rawMessage)
      return

    try {
      const message = JSON.parse(rawMessage) as WsMessageToClient

      // eslint-disable-next-line no-console
      console.log('[WebSocket] Message received', message)

      try {
        const handler = eventHandlers.get(message.type)
        if (handler) {
          handler(message)
          return
        }

        switch (message.type) {
          case 'server:connected':
            connectionStore.getActiveSession()!.isConnected = message.data.connected
            connectionStore.setActiveSession(message.data.sessionId, {})
            break

          case 'auth:needCode':
            connectionStore.auth.needCode = true
            break

          case 'auth:needPassword':
            connectionStore.auth.needPassword = true
            break

          case 'auth:connected':
            connectionStore.getActiveSession()!.isConnected = true
            sendEvent('entity:getMe', undefined)
            break

          case 'entity:me':
            connectionStore.getActiveSession()!.me = message.data
            break

          case 'takeout:task:progress': {
            const { currentTask } = storeToRefs(useSyncTaskStore())
            currentTask.value = message.data
            break
          }

          default:
          {
            // eslint-disable-next-line no-console
            console.log('[WebSocket] Unknown message')
          }
        }
      }
      catch (error) {
        console.error('[WebSocket] Failed to process message', error)
      }
    }
    catch {
      console.error('[WebSocket] Invalid message', rawMessage)
    }
  })

  return {
    sendEvent,
    registerEventHandler,
    unregisterEventHandler,
  }
}

export function useWebsocketV2(sessionId: string) {
  if (!wsContext)
    wsContext = createWebsocketV2Context(sessionId)

  return wsContext
}
