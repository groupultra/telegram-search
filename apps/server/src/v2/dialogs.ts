import type { ClientState } from '../app'
import type { WsMessage } from './ws-event'

import { useLogger } from '@tg-search/common'

import { sendWsError, sendWsEvent } from './ws-event'

export function registerDialogsEventHandler(state: ClientState) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx

  emitter.on('dialog:list', ({ dialogs }) => {
    sendWsEvent(peer, 'dialog:list', { dialogs })
  })
}

export function handleDialogsEvent(
  state: ClientState,
  message: WsMessage,
) {
  const logger = useLogger()

  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx

  logger.withFields(message).debug('handleDialogsEvent')

  switch (message.type) {
    case 'dialog:fetch':
      emitter.emit('dialog:fetch')
      break
    default:
      sendWsError(peer, 'Unknown message type')
  }
}
