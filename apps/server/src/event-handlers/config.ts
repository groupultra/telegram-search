import type { Config } from '@tg-search/common'
import type { WsMessageToServer } from '../utils/ws-event'
import type { ClientState } from '../ws'

import { sendWsError, sendWsEvent } from '../utils/ws-event'

export function registerConfigEventHandler(state: ClientState) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx

  emitter.on('config:result', (data: { config: Config }) => {
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
