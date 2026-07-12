import type { EventContext } from '@moeru/eventa'

import type { ApplicationBridge } from '../types/bridge'

import { defineInvokes } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/websocket/native'
import { chatContracts, messageContracts, statsContracts } from '@tg-search/protocol'

export function createWebSocketApplicationBridge(getSocket: () => WebSocket | undefined): ApplicationBridge {
  let eventContext: EventContext<any, any> | undefined

  function getInvokes() {
    const socket = getSocket()
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    if (!eventContext) {
      eventContext = createContext(socket).context
    }
    return {
      chats: defineInvokes(eventContext, chatContracts),
      messages: defineInvokes(eventContext, messageContracts),
      stats: defineInvokes(eventContext, statsContracts),
    }
  }

  return {
    listChats: input => getInvokes().chats.list(input),
    listRemoteMessages: input => getInvokes().messages.listRemote(input),
    queryLocalMessages: input => getInvokes().messages.queryLocal(input),
    searchLocalMessages: input => getInvokes().messages.searchLocal(input),
    getLocalMessageContext: input => getInvokes().messages.contextLocal(input),
    getLocalStats: input => getInvokes().stats.get(input),
  }
}
