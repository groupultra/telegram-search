import type { ClientState } from '../app'
import type { WsMessageToServer } from './ws-event'

import { useLogger } from '@tg-search/common'

import { sendWsError, sendWsEvent } from './ws-event'

export function registerConnectionEventHandler(state: ClientState) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return null
  }
}

export function handleConnectionEvent(
  state: ClientState,
  message: WsMessageToServer,
) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return null
  }

  const { emitter } = ctx

  useLogger().withFields(message).debug('handleConnectionEvent')

  switch (message.type) {
    case 'auth:login':
      state.phoneNumber = message.data.phoneNumber

      emitter.emit('auth:login', message.data)

      emitter.once('auth:connected', () => {
        state.isConnected = true
        sendWsEvent(peer, 'auth:connected', {})
      })

      emitter.once('auth:needCode', () => {
        sendWsEvent(peer, 'auth:needCode', undefined)
      })
      emitter.once('auth:needPassword', () => {
        sendWsEvent(peer, 'auth:needPassword', undefined)
      })
      break
    case 'auth:code':
      emitter.emit('auth:code', message.data)
      break
    case 'auth:password':
      emitter.emit('auth:password', message.data)
      break
    case 'auth:logout':
      state.isConnected = false
      emitter.emit('auth:logout')
      break
    default:
      sendWsError(peer, 'Unknown message type')
  }
}
