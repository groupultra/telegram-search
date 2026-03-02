import type { FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

import { useLogger } from '@guiiai/logg'
import { wsSendFailTotal } from '@tg-search/observability'

export interface WsEventMeta {
  tracingId: string
}

// ============================================================================
// Compatibility types for packages/client (Phase 5 will remove these)
// ============================================================================

export interface WsEventFromServer {
  'server:connected': (data: { sessionId: string, accountReady: boolean }) => void
}

export interface WsEventFromClient {
  'server:event:register': (data: { event: string }) => void
}

export type WsEventToServer = ToCoreEvent & WsEventFromClient
export type WsEventToClient = FromCoreEvent & WsEventFromServer

/** Extract data type from a WsEventToClient entry */
export type WsEventToClientData<T extends keyof WsEventToClient> = Parameters<WsEventToClient[T]>[0]

/** Extract data type from a WsEventToServer entry */
export type WsEventToServerData<T extends keyof WsEventToServer> = Parameters<WsEventToServer[T]>[0]

/**
 * Wire protocol message from server → client.
 * Uses typed event names for client compatibility (Phase 5 will simplify).
 */
export type WsMessageToClient = {
  [K in keyof WsEventToClient]: {
    type: K
    data: WsEventToClientData<K>
  }
}[keyof WsEventToClient]

/**
 * Wire protocol message from client → server.
 * Uses typed event names for client compatibility (Phase 5 will simplify).
 */
export type WsMessageToServer = {
  [K in keyof WsEventToServer]: {
    type: K
    data?: WsEventToServerData<K>
    meta?: WsEventMeta
  }
}[keyof WsEventToServer]

export function sendWsEvent(
  peer: Peer,
  event: string,
  data: unknown,
) {
  peer.send(createWsMessage(event, data))
}

export function createWsMessage(
  type: string,
  data: unknown,
): WsMessageToClient {
  if (!data)
    return { type, data: undefined } as unknown as WsMessageToClient

  try {
    // ensure payload can be stringified and is within size limits
    const stringifiedData = JSON.stringify(data)
    if (stringifiedData.length > 1024 * 1024) {
      useLogger().withFields({ type, size: stringifiedData.length }).warn('Dropped event data')
      wsSendFailTotal.add(1, { reason: 'payload_too_large' })
      return { type, data: undefined } as unknown as WsMessageToClient
    }

    return { type, data } as unknown as WsMessageToClient
  }
  catch (err) {
    useLogger().withFields({ type }).withError(err).warn('Dropped event data')
    wsSendFailTotal.add(1, { reason: 'stringify_error' })

    return { type, data: undefined } as unknown as WsMessageToClient
  }
}
