import type { ClientState } from '../app'
import type { WsMessage } from './ws-event'

import { sendWsError } from './ws-event'

export function handleMessageEvent(
  state: ClientState,
  message: WsMessage,
) {
  const { peer } = state

  switch (message.type) {
    case 'message:fetch':
      break
    case 'message:process':
      break
    // ... 其他消息类型
    default:
      sendWsError(peer, 'Unknown message type')
  }
}
