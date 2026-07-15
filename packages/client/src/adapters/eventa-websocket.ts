import type { EventContext } from '@moeru/eventa'

import type { ApplicationBridge } from '../types/bridge'

import { defineInvokes } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/websocket/native'
import { chatContracts, messageContracts, statsContracts } from '@tg-search/protocol'

export function createWebSocketApplicationBridge(getSocket: () => WebSocket | undefined): ApplicationBridge {
  let binding: { socket: WebSocket, context: EventContext<any, any>, dispose: () => void } | undefined

  function bindSocket(socket: WebSocket) {
    const facade: Pick<WebSocket, 'send' | 'url'> & {
      onclose: WebSocket['onclose']
      onerror: WebSocket['onerror']
      onmessage: WebSocket['onmessage']
      onopen: WebSocket['onopen']
    } = {
      url: socket.url,
      send: data => socket.send(data),
      onclose: null,
      onerror: null,
      onmessage: null,
      onopen: null,
    }
    const forwardMessage = (event: MessageEvent) => facade.onmessage?.call(socket, event)
    const forwardClose = (event: CloseEvent) => facade.onclose?.call(socket, event)
    const forwardError = (event: Event) => facade.onerror?.call(socket, event)
    socket.addEventListener('message', forwardMessage)
    socket.addEventListener('close', forwardClose)
    socket.addEventListener('error', forwardError)
    const context = createContext(facade as WebSocket).context
    return {
      socket,
      context,
      dispose: () => {
        socket.removeEventListener('message', forwardMessage)
        socket.removeEventListener('close', forwardClose)
        socket.removeEventListener('error', forwardError)
        context.abort(new Error('WebSocket application bridge disposed'))
      },
    }
  }

  function getInvokes() {
    const socket = getSocket()
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    if (!binding || binding.socket !== socket) {
      binding?.dispose()
      binding = bindSocket(socket)
    }
    const eventContext = binding.context
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
    dispose: () => {
      binding?.dispose()
      binding = undefined
    },
  }
}
