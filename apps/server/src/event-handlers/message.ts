import type { CoreEvent, CoreEventData } from '@tg-search/core'
import type { ClientState } from '../app'
import type { WsMessageToServer } from '../utils/ws-event'

import { useLogger } from '@tg-search/common'

import { sendWsError, sendWsEvent } from '../utils/ws-event'

export function registerMessageEventHandler(state: ClientState) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return null
  }
}

export function handleMessageEvent(
  state: ClientState,
  message: WsMessageToServer,
) {
  const { peer, ctx } = state
  if (!ctx) {
    sendWsError(peer, 'Client not initialized')
    return
  }

  const { emitter } = ctx

  function onProgress(data: CoreEventData<CoreEvent['message:fetch:progress']>) {
    if (data.progress === 100) {
      emitter.removeListener('message:fetch:progress', onProgress)
    }

    sendWsEvent(peer, 'message:fetch:progress', data)
  }

  useLogger().withFields(message).debug('handleMessageEvent')

  switch (message.type) {
    case 'message:fetch':
      emitter.emit('message:fetch', message.data)
      emitter.on('message:fetch:progress', onProgress)
      break
    case 'message:fetch:abort':
      emitter.emit('message:fetch:abort', message.data)
      emitter.removeListener('message:fetch:progress', onProgress)
      break
    default:
      sendWsError(peer, 'Unknown message type')
  }
}
