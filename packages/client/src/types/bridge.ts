import type {
  WsEventToClient,
  WsEventToClientData,
  WsEventToServer,
  WsEventToServerData,
  WsMessageToServer,
} from '@tg-search/server/types'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export interface BridgeAdapter {
  /**
   * Initialize the bridge adapter.
   */
  init: () => Promise<void>
  sendEvent: ClientSendEventFn
  waitForEvent: <T extends keyof WsEventToClient>(event: T) => Promise<WsEventToClientData<T>>
}
