import type { ClientState } from '../app'
import type { WsEvent, WsMessage } from './event-handler'

import { sendWsError } from './event-handler'

export function handleMessageEvent(state: ClientState, message: WsMessage<keyof WsEvent>) {
  const { peer } = state

  switch (message.type) {
    // Handle different message types here
    default:
      sendWsError(peer, 'Unknown type')
  }
}
