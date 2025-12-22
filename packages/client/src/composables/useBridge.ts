import type { WsEventToServer, WsEventToServerData, WsMessageToServer } from '@tg-search/server/types'

import { IS_CORE_MODE } from '../../constants'
import { useCoreBridgeStore } from '../adapters/core-bridge'
import { useWebsocketStore } from '../adapters/websocket'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export function useBridgeStore() {
  if (IS_CORE_MODE) {
    return useCoreBridgeStore()
  }
  else {
    return useWebsocketStore()
  }
}
