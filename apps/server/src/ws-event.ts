import type { FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

import { useLogger } from '@tg-search/logg'

export interface WsEventFromServer {
  'server:connected': (data: { sessionId: string, connected: boolean }) => void
  'server:error': (data: { error?: string | Error | unknown }) => void
}

export interface WsEventFromClient {
  'server:event:register': (data: { event: keyof WsEventToClient }) => void
}

export type WsEventToServer = ToCoreEvent & WsEventFromClient
export type WsEventToClient = FromCoreEvent & WsEventFromServer
// export type WsEvent = WsEventToServer & WsEventToClient

export type WsEventToServerData<T extends keyof WsEventToServer> = Parameters<WsEventToServer[T]>[0]
export type WsEventToClientData<T extends keyof WsEventToClient> = Parameters<WsEventToClient[T]>[0]

export type WsMessageToClient = {
  [T in keyof WsEventToClient]: {
    type: T
    data: WsEventToClientData<T>
  }
}[keyof WsEventToClient]

export type WsMessageToServer = {
  [T in keyof WsEventToServer]: {
    type: T
    data: WsEventToServerData<T>
  }
}[keyof WsEventToServer]

// export type WsMessage = WsMessageToClient | WsMessageToServer

export function sendWsEvent<T extends keyof WsEventToClient>(
  peer: Peer,
  event: T,
  data: WsEventToClientData<T>,
) {
  peer.send(createWsMessage(event, data))
}

export function sendWsError(
  peer: Peer,
  error?: string | Error | unknown,
) {
  sendWsEvent(peer, 'server:error', {
    error: error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
  })
}

export function createWsMessage<T extends keyof WsEventToClient>(
  type: T,
  data: WsEventToClientData<T>,
): Extract<WsMessageToClient, { type: T }> {
  try {
    // ensure args[0] can be stringified
    JSON.stringify(data)

    return { type, data } as Extract<WsMessageToClient, { type: T }>
  }
  catch {
    useLogger().withFields({ type }).warn('Dropped event data')

    return { type, data: undefined } as Extract<WsMessageToClient, { type: T }>
  }
}

// export function isMessageType<K extends keyof WsEvent>(
//   message: WsMessageToClient | WsMessageToServer,
//   type: K,
// ): message is WsMessageToClient {
//   return message.type === type
// }

// export function toWsMessage(message: Message): WsMessageToClient | WsMessageToServer | null {
//   if ('type' in message && typeof message.type === 'string') {
//     return message as WsMessageToClient | WsMessageToServer
//   }
//   return null
// }
