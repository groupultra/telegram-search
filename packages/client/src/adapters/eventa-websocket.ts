import type { EventContext } from '@moeru/eventa'
import type { SignInTicketResult } from '@tg-search/core'

import type { ApplicationBridge } from '../types/bridge'

import { defineInvoke, defineInvokes } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/websocket/native'
import { signInTicketContract, UI_HEARTBEAT_PONG } from '@tg-search/core'
import { chatContracts, messageContracts, statsContracts } from '@tg-search/protocol'

export interface WebSocketEventaBridge extends ApplicationBridge {
  /** The Eventa context bound to the current socket; binds it on first use. */
  getContext: () => EventContext<any, any>
  requestSignInTicket: () => Promise<SignInTicketResult>
}

/**
 * One Eventa context per socket, shared by UI contracts and application
 * invokes. `onBind` runs for each new context, before any frame on that
 * socket is delivered, so listeners added there see the first notification.
 */
export function createWebSocketApplicationBridge(
  getSocket: () => WebSocket | undefined,
  options: { onBind?: (context: EventContext<any, any>) => void } = {},
): WebSocketEventaBridge {
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
    const forwardMessage = (event: MessageEvent) => {
      if (event.data === UI_HEARTBEAT_PONG)
        return
      facade.onmessage?.call(socket, event)
    }
    const forwardClose = (event: CloseEvent) => facade.onclose?.call(socket, event)
    const forwardError = (event: Event) => facade.onerror?.call(socket, event)
    socket.addEventListener('message', forwardMessage)
    socket.addEventListener('close', forwardClose)
    socket.addEventListener('error', forwardError)
    const context = createContext(facade as WebSocket).context
    options.onBind?.(context)
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

  function getContext() {
    const socket = getSocket()
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    if (!binding || binding.socket !== socket) {
      binding?.dispose()
      binding = bindSocket(socket)
    }
    return binding.context
  }

  function getInvokes() {
    const eventContext = getContext()
    return {
      chats: defineInvokes(eventContext, chatContracts),
      messages: defineInvokes(eventContext, messageContracts),
      stats: defineInvokes(eventContext, statsContracts),
    }
  }

  return {
    getContext,
    requestSignInTicket: () => defineInvoke(getContext(), signInTicketContract)(),
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
