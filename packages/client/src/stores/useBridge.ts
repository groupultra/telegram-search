import type { WsEventToServer, WsEventToServerData, WsMessageToServer } from '@tg-search/server/types'

import { initConfig } from '@tg-search/common'
import { defineStore, storeToRefs } from 'pinia'

import { useCoreBridgeStore } from '../adapters/core-bridge'
import { useWebsocketStore } from '../adapters/websocket'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export const useBridgeStore = defineStore('websocket', () => {
  let websocketStore: ReturnType<typeof useWebsocketStore> | ReturnType<typeof useCoreBridgeStore>
  initConfig()
  if (import.meta.env.VITE_CORE_IN_BROWSER) {
    websocketStore = useCoreBridgeStore()
  }
  else {
    websocketStore = useWebsocketStore()
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
