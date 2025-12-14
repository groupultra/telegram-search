import type { FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

import { useLogger } from '@guiiai/logg'
import { Counter } from 'prom-client'

export interface WsEventFromServer {
  'server:connected': (data: { sessionId: string, accountReady: boolean }) => void
}

export interface WsEventFromClient {
  'server:event:register': (data: { event: keyof WsEventToClient }) => void
}

export type WsEventToServer = ToCoreEvent & WsEventFromClient
export type WsEventToClient = FromCoreEvent & WsEventFromServer

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

const wsSendFailTotal = new Counter({
  name: 'ws_send_fail_total',
  help: 'Total number of failed WebSocket sends from server to client',
  labelNames: ['reason'] as const,
})

export function sendWsEvent<T extends keyof WsEventToClient>(
  peer: Peer,
  event: T,
  data: WsEventToClientData<T>,
) {
  peer.send(createWsMessage(event, data))
}

export function createWsMessage<T extends keyof WsEventToClient>(
  type: T,
  data: WsEventToClientData<T>,
): Extract<WsMessageToClient, { type: T }> {
  try {
    // ensure args[0] can be stringified
    const stringifiedData = JSON.stringify(data)
    if (stringifiedData.length > 1024 * 1024) {
      useLogger().withFields({ type, size: stringifiedData.length }).warn('Dropped event data')
      wsSendFailTotal.inc({ reason: 'payload_too_large' })
      return { type, data: undefined } as Extract<WsMessageToClient, { type: T }>
    }

    return { type, data } as Extract<WsMessageToClient, { type: T }>
  }
  catch {
    useLogger().withFields({ type }).warn('Dropped event data')
    wsSendFailTotal.inc({ reason: 'stringify_error' })

    return { type, data: undefined } as Extract<WsMessageToClient, { type: T }>
  }
}
