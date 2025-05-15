import type { WsEventToClient, WsEventToClientData, WsEventToServer, WsEventToServerData, WsMessageToServer } from '@tg-search/server'
import type { ClientEventHandlerMap, ClientEventHandlerQueueMap } from '../event-handlers'

import { defineStore } from 'pinia'
import { onMounted } from 'vue'

import { getRegisterEventHandler, registerAllEventHandlers } from '../event-handlers'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export const useWebsocketStore = defineStore('websocket', () => {
  onMounted(() => {
    window.channel.open()
  })

  const createWsMessage: ClientCreateWsMessageFn = (type, data) => {
    return { type, data } as WsMessageToServer
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L29-L37
  const sendEvent: ClientSendEventFn = (event, data) => {
    if (event !== 'server:event:register')
      // eslint-disable-next-line no-console
      console.log('[WebSocket] Sending event', event, data)

    window.channel.message(createWsMessage(event, data))
  }

  const eventHandlers: ClientEventHandlerMap = new Map()
  const eventHandlersQueue: ClientEventHandlerQueueMap = new Map()
  const registerEventHandler = getRegisterEventHandler(eventHandlers, sendEvent)
  registerAllEventHandlers(registerEventHandler)

  function waitForEvent<T extends keyof WsEventToClient>(event: T) {
    // eslint-disable-next-line no-console
    console.log('[WebSocket] Waiting for event', event)

    return new Promise((resolve) => {
      const handlers = eventHandlersQueue.get(event) ?? []
      handlers.push((data) => {
        // eslint-disable-next-line no-console
        console.log('[WebSocket] Resolving event', event, data)

        resolve(data)
      })
      eventHandlersQueue.set(event, handlers)
    }) satisfies Promise<WsEventToClientData<T>>
  }

  // https://github.com/moeru-ai/airi/blob/b55a76407d6eb725d74c5cd4bcb17ef7d995f305/apps/realtime-audio/src/pages/index.vue#L95-L123
  window.channel.onMessage((message) => {
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

    if (eventHandlersQueue.has(message.type)) {
      const fnQueue = eventHandlersQueue.get(message.type) ?? []

      try {
        fnQueue.forEach((inQueueFn) => {
          inQueueFn(message.data)
          fnQueue.pop()
        })
      }
      catch (error) {
        console.error('[WebSocket] Error handling queued event', message, error)
      }
    }
  })

  return {
    sendEvent,
    waitForEvent,
  }
})
