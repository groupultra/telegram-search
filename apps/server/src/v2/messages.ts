import type { ClientState } from '../app'
import type { WsEvent, WsMessage } from './ws-event'

import { sendWsError } from './ws-event'

export function handleMessageEvent(
  state: ClientState,
  message: WsMessage<keyof WsEvent>,
) {
  const { peer } = state

  switch (message.type) {
    case 'message:fetch':
      break
    // Handle different message types here
    default:
      sendWsError(peer, 'Unknown message type')
  }
}
