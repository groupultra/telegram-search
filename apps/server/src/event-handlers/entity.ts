import type { ClientState } from '../app'
import type { WsMessageToServer } from '../utils/ws-event'

import { useLogger } from '@tg-search/common'

import { sendWsError, sendWsEvent } from '../utils/ws-event'

export function registerEntityEventHandler(state: ClientState) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx

  emitter.on('entity:me', (data) => {
    sendWsEvent(peer, 'entity:me', data)
  })
}

export function handleEntityEvent(
  state: ClientState,
  message: WsMessageToServer,
) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx

  useLogger().withFields(message).debug('handleEntityEvent')

  switch (message.type) {
    case 'entity:getMe':
      emitter.emit('entity:getMe')
      break
    default:
      sendWsError(peer, 'Unknown message type')
  }
}
