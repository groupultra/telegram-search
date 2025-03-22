import type { CoreEvent } from '@tg-search/core'
import type { Message, Peer } from 'crossws'

export interface WsServerEvent {
  'server:connected': (data: { clientId: string }) => void
  'server:error': (data: { error?: string | Error | unknown }) => void
}

export type WsEvent = CoreEvent & WsServerEvent

export type WsEventData<T extends keyof WsEvent> = Parameters<WsEvent[T]>[0]

export type WsMessage = {
  [T in keyof WsEvent]: {
    type: T
    data: Parameters<WsEvent[T]>[0]
  }
}[keyof WsEvent]

export function sendWsEvent<T extends keyof WsEvent>(
  peer: Peer,
  event: T,
  data: Parameters<WsEvent[T]>[0],
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

export function createWsMessage<T extends keyof WsEvent>(
  type: T,
  data: Parameters<WsEvent[T]>[0],
): Extract<WsMessage, { type: T }> {
  // TODO: just send necessary data
  // const safeData = stringify(pickBy(data, value => typeof value !== 'function'))
  // return { type, data: JSON.parse(safeData) } as Extract<WsMessage, { type: T }>
  return { type, data } as Extract<WsMessage, { type: T }>
}

export function isMessageType<K extends keyof WsEvent>(
  message: WsMessage,
  type: K,
): message is WsMessage {
  return message.type === type
}

export function toWsMessage(message: Message): WsMessage | null {
  if ('type' in message && typeof message.type === 'string') {
    return message as WsMessage
  }
  return null
}
