import type { WsEventToServer, WsEventToServerData, WsMessageToServer } from '@tg-search/server/types'

import { initConfig } from '@tg-search/common'
import { defineStore, storeToRefs } from 'pinia'

import { useCoreBridgeWebsocketStore } from './useCoreBridgeWebsocket'
import { useOriginWebsocketStore } from './useOriginWebsocket'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export const useWebsocketStore = defineStore('websocket', () => {
  let websocketStore: ReturnType<typeof useOriginWebsocketStore> | ReturnType<typeof useCoreBridgeWebsocketStore>
  initConfig()
  if (import.meta.env.VITE_CORE_IN_BROWSER) {
    websocketStore = useCoreBridgeWebsocketStore()
  }
  else {
    websocketStore = useOriginWebsocketStore()
  }

  const { getActiveSession, updateActiveSession, cleanup, sendEvent, waitForEvent } = websocketStore
  const { sessions, activeSessionId } = storeToRefs(websocketStore)

  return {
    sessions,
    activeSessionId,
    getActiveSession,
    updateActiveSession,
    cleanup,

    // WebSocket
    sendEvent,
    waitForEvent,
  }
})
