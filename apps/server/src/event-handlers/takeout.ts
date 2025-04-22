import type { CoreEvent, CoreEventData } from '@tg-search/core'
import type { WsMessageToServer } from '../utils/ws-event'
import type { ClientState } from '../ws'

import { useLogger } from '@tg-search/common'

import { sendWsError, sendWsEvent } from '../utils/ws-event'

export function registerTakeoutEventHandler(state: ClientState) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return null
  }
}

export function handleTakeoutEvent(
  state: ClientState,
  message: WsMessageToServer,
) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx

  function onProgress(data: CoreEventData<CoreEvent['takeout:task:progress']>) {
    if (data.progress === 100) {
      emitter.removeListener('takeout:task:progress', onProgress)
    }

    sendWsEvent(peer, 'takeout:task:progress', data)
  }

  useLogger().withFields(message).debug('handleTakeoutEvent')

  switch (message.type) {
    case 'takeout:run':
      emitter.emit('takeout:run', message.data)
      emitter.on('takeout:task:progress', onProgress)
      break
    default:
      sendWsError(peer, 'Unknown message type')
  }
}
