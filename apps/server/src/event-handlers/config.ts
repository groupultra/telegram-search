import type { ClientState } from '../app'
import type { WsMessageToServer } from './ws-event'

import { sendWsError, sendWsEvent } from './ws-event'

export function registerConfigEventHandler(state: ClientState) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx

  emitter.on('config:result', (data) => {
    sendWsEvent(peer, 'config:result', data)
  })
}

export function handleConfigEvent(state: ClientState, message: WsMessageToServer) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx
  switch (message.type) {
    case 'config:get':
      emitter.emit('config:get')
      break
    case 'config:save':
      emitter.emit('config:save', message.data)
      break
    default:
      sendWsError(peer, 'Unknown message type')
  }
}
