import type { FromCoreEvent, ToCoreEvent } from '@tg-search/core'

import { useLogger } from '@tg-search/common'

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

export function createWsErrorMessage(
  error?: string | Error | unknown,
): Extract<WsMessageToClient, { type: 'server:error' }> {
  return createWsMessage('server:error', {
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
