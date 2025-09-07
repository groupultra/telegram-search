import type { WsEventToServer, WsEventToServerData, WsMessageToServer } from '@tg-search/server/types'

import { defineStore, storeToRefs } from 'pinia'

import { useCoreBridgeStore } from '../adapters/core-bridge'
import { useWebsocketStore } from '../adapters/websocket'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export const useBridgeStore = defineStore('websocket', () => {
  let store: ReturnType<typeof useWebsocketStore> | ReturnType<typeof useCoreBridgeStore>

  if (import.meta.env.VITE_WITH_CORE) {
    store = useCoreBridgeStore()
    store.init()
  }
  else {
    store = useWebsocketStore()
  }

  const { getActiveSession, updateActiveSession, cleanup, sendEvent, waitForEvent } = store
  const { sessions, activeSessionId } = storeToRefs(store)

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
