import type { WsEventToServer, WsEventToServerData, WsMessageToServer } from '@tg-search/server/types'

import { useCoreBridgeStore } from '../adapters/core-bridge'
import { useWebsocketStore } from '../adapters/websocket'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export function useBridgeStore() {
  if (import.meta.env.VITE_WITH_CORE) {
    return useCoreBridgeStore()
  }
  else {
    return useWebsocketStore()
  }
}
