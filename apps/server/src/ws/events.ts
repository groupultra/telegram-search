import type { FromCoreEvent, ToCoreEvent } from '@tg-search/core'

import type { Peer } from './types'

import { useLogger } from '@guiiai/logg'

export interface WsEventFromServer {
  'server:connected': (data: { sessionId: string, connected: boolean }) => void
  'server:error': (data: { error?: string | Error | unknown }) => void
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

export function sendWsEvent<T extends keyof WsEventToClient>(
  peer: Peer,
  event: T,
  data: WsEventToClientData<T>,
) {
  peer.send(createWsMessage(event, data))
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return err.message
  }
  return String(err ?? 'Unknown error')
}

export function createWsMessage<T extends keyof WsEventToClient>(
  type: T,
  data: WsEventToClientData<T>,
): Extract<WsMessageToClient, { type: T }> {
  try {
    // ensure args[0] can be stringified
    const stringifiedData = JSON.stringify(data)
    if (stringifiedData.length > 1024 * 1024) {
      useLogger().withFields({ type, length: stringifiedData.length }).warn('Dropped event data')
      return { type, data: undefined } as Extract<WsMessageToClient, { type: T }>
    }

    if (data && 'error' in data) {
      data.error = serializeError(data.error)
    }

    return { type, data } as Extract<WsMessageToClient, { type: T }>
  }
  catch {
    useLogger().withFields({ type }).warn('Dropped event data')

    return { type, data: undefined } as Extract<WsMessageToClient, { type: T }>
  }
}
