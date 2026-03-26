import type { WsEventToClient, WsEventToClientData } from '@tg-search/server/types'

import type { ClientSendEventFn } from '../types/bridge'

export type ClientEventHandler<T extends keyof WsEventToClient> = (data: WsEventToClientData<T>) => void
export interface ClientQueuedEventHandler<T extends keyof WsEventToClient> {
  handler: ClientEventHandler<T>
  predicate?: (data: WsEventToClientData<T>) => boolean
  createdAt?: number
}
export type ClientRegisterEventHandler = <T extends keyof WsEventToClient>(event: T, handler: ClientEventHandler<T>) => void
export type ClientEventHandlerMap = Map<keyof WsEventToClient, ClientEventHandler<keyof WsEventToClient>>
export type ClientEventHandlerQueueMap = Map<keyof WsEventToClient, ClientQueuedEventHandler<keyof WsEventToClient>[]>

export function getRegisterEventHandler(
  eventHandlersMap: ClientEventHandlerMap,
  sendEvent: ClientSendEventFn,
) {
  const registerEventHandler: ClientRegisterEventHandler = (event, handler) => {
    eventHandlersMap.set(event, handler)

    sendEvent('server:event:register', { event })
  }

  return registerEventHandler
}

export type ClientRegisterEventHandlerFn = ReturnType<typeof getRegisterEventHandler>
