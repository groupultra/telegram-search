import type { FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

export interface WsEventFromServer {
  'server:connected': (data: { sessionId: string, connected: boolean }) => void
  'server:error': (data: { error?: string | Error | unknown }) => void
}

export type WsEventToServer = ToCoreEvent
export type WsEventToClient = FromCoreEvent & WsEventFromServer
// export type WsEvent = WsEventToServer & WsEventToClient

// export type WsEventData<T extends keyof WsEvent> = Parameters<WsEvent[T]>[0]

export type WsMessageToClient = {
  [T in keyof WsEventToClient]: {
    type: T
    data: Parameters<WsEventToClient[T]>[0]
  }
}[keyof WsEventToClient]

export type WsMessageToServer = {
  [T in keyof WsEventToServer]: {
    type: T
    data: Parameters<WsEventToServer[T]>[0]
  }
}[keyof WsEventToServer]

// export type WsMessage = WsMessageToClient | WsMessageToServer

export function sendWsEvent<T extends keyof WsEventToClient>(
  peer: Peer,
  event: T,
  data: Parameters<WsEventToClient[T]>[0],
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
  data: Parameters<WsEventToClient[T]>[0],
): Extract<WsMessageToClient, { type: T }> {
  // TODO: just send necessary data
  // const safeData = stringify(pickBy(data, value => typeof value !== 'function'))
  // return { type, data: JSON.parse(safeData) } as Extract<WsMessage, { type: T }>
  return { type, data } as Extract<WsMessageToClient, { type: T }>
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
