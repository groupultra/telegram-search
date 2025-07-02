import type { WsEventToClient, WsEventToClientData } from '@tg-search/server/types'

import type { ClientSendEventFn } from '../stores/useWebsocket'

import { registerAuthEventHandlers } from './auth'
import { registerConfigEventHandlers } from './config'
import { registerDialogEventHandlers } from './dialog'
import { registerEntityEventHandlers } from './entity'
import { registerMessageEventHandlers } from './message'
import { registerServerEventHandlers } from './server'
import { registerStorageEventHandlers } from './storage'
import { registerTakeoutEventHandlers } from './takeout'

export type ClientEventHandler<T extends keyof WsEventToClient> = (data: WsEventToClientData<T>) => void
export type ClientRegisterEventHandler = <T extends keyof WsEventToClient>(event: T, handler: ClientEventHandler<T>) => void
export type ClientEventHandlerMap = Map<keyof WsEventToClient, ClientEventHandler<keyof WsEventToClient>>
export type ClientEventHandlerQueueMap = Map<keyof WsEventToClient, ClientEventHandler<keyof WsEventToClient>[]>

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

export function registerAllEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  registerServerEventHandlers(registerEventHandler)
  registerAuthEventHandlers(registerEventHandler)
  registerEntityEventHandlers(registerEventHandler)
  registerTakeoutEventHandlers(registerEventHandler)
  registerConfigEventHandlers(registerEventHandler)
  registerDialogEventHandlers(registerEventHandler)
  registerStorageEventHandlers(registerEventHandler)
  registerMessageEventHandlers(registerEventHandler)
}
