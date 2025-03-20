import type { CoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

// type EventHandler = (ctx: CoreContext, message: Message)

export interface WsEvent extends CoreEvent {
  error: (error?: string | Error | unknown) => void
}

export type WsEventData<T extends keyof WsEvent> = WsEvent[T]

export function sendWsEvent<T extends keyof WsEvent>(peer: Peer, event: T, data?: WsEventData<T>) {
  peer.send(new WsMessage(event, data))
}

export function sendWsError(peer: Peer, error?: string | Error | unknown) {
  sendWsEvent(peer, 'error', () => {
    return error ? error instanceof Error ? error : new Error(String(error)) : undefined
  })
}

export class WsMessage<T extends keyof WsEvent> {
  type: T
  data?: WsEventData<T>

  constructor(type: T, data?: WsEventData<T>) {
    this.type = type
    this.data = data
  }
}
