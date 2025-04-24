import type { ClientState } from './app'
import type { WsMessageToServer } from './utils/ws-event'

import { useLogger } from '@tg-search/common'

import { sendWsError } from './utils/ws-event'

type WsMessageRoute = (state: ClientState, message: WsMessageToServer) => void
const wsMessageRoutes = new Map<string, WsMessageRoute>()

export function routeWsMessage(state: ClientState, message: WsMessageToServer) {
  const name = message.type.split(':')[0]

  if (message.type.startsWith(name)) {
    const fn = wsMessageRoutes.get(name)
    if (fn) {
      fn(state, message)
    }
    else {
      sendWsError(state.peer, `Unknown message type: ${message.type}`)
    }
  }
}

export function registerWsMessageRoute(name: string, fn: WsMessageRoute) {
  useLogger().withFields({ name }).debug('Registering ws message route')
  wsMessageRoutes.set(name, fn)
}
