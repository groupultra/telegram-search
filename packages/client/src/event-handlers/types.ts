import type { WsEventToClient, WsEventToClientData } from '@tg-search/server/types'

import type { ClientSendEventFn } from '../composables/useBridge'

// Event handler types
export type ClientEventHandler<T extends keyof WsEventToClient> = (data: WsEventToClientData<T>) => void
export type ClientRegisterEventHandler = <T extends keyof WsEventToClient>(event: T, handler: ClientEventHandler<T>) => void
export type ClientEventHandlerMap = Map<keyof WsEventToClient, ClientEventHandler<keyof WsEventToClient>>
export type ClientEventHandlerQueueMap = Map<keyof WsEventToClient, ClientEventHandler<keyof WsEventToClient>[]>

export type ClientRegisterEventHandlerFn = (event: keyof WsEventToClient, handler: ClientEventHandler<keyof WsEventToClient>) => void

// Factory function for creating register event handler
export function getRegisterEventHandler(
  eventHandlersMap: ClientEventHandlerMap,
  sendEvent: ClientSendEventFn,
): ClientRegisterEventHandlerFn {
  return (event, handler) => {
    eventHandlersMap.set(event, handler)
    sendEvent('server:event:register', { event })
  }
}
