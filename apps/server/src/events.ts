import type { FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'
import { wsSendFailTotal } from '@tg-search/observability'

export interface WsEventMeta {
  tracingId: string
}

export interface WsEventFromServer {
  'server:connected': (data: { sessionId: string, accountReady: boolean }) => void
  /** A single-use ticket for `POST /api/auth/sign-in/telegram-session`, or why none was issued. */
  'server:sign-in-ticket': (data: { ticket: string } | { error: 'OAUTH_DISABLED' | 'ACCOUNT_NOT_READY' | 'TICKET_FAILED' }) => void
}

export interface WsEventFromClient {
  'server:event:register': (data: { event: keyof WsEventToClient }) => void
  /** Requests a sign-in ticket for the Telegram account this session is logged in to. */
  'server:sign-in-ticket': (data: undefined) => void
}

/**
 * Core events a WebSocket client may emit. Every other core event is internal:
 * persistence (`storage:record:*`), Telegram updates (`gram:*`), message
 * processing, `account:ready`, and cleanup. Those handlers trust their payload
 * because only core code emits them, so a client must never reach them.
 * Add an event here only when the UI sends it and its handler scopes all reads
 * and writes to `ctx.getCurrentAccountId()`.
 */
export const CLIENT_EMITTABLE_CORE_EVENTS: ReadonlySet<string> = new Set<keyof ToCoreEvent>([
  CoreEventType.AuthLogin,
  CoreEventType.AuthLogout,
  CoreEventType.AuthCode,
  CoreEventType.AuthPassword,

  CoreEventType.ConfigFetch,
  CoreEventType.ConfigUpdate,

  CoreEventType.DialogFoldersFetch,
  CoreEventType.DialogAvatarFetch,

  CoreEventType.EntityAvatarFetch,
  CoreEventType.EntityAvatarPrimeCache,
  CoreEventType.EntityChatAvatarPrimeCache,

  CoreEventType.MessageFetchSummary,
  CoreEventType.MessageRead,
  CoreEventType.MessageReprocess,
  CoreEventType.MessageSend,

  CoreEventType.StorageFetchDialogs,
  CoreEventType.StorageSearchMessages,
  CoreEventType.StorageSearchPhotos,
  CoreEventType.StorageFetchMessageEditMarks,
  CoreEventType.StorageChatNote,

  CoreEventType.TakeoutRun,
  CoreEventType.TakeoutTaskAbort,
  CoreEventType.TakeoutStatsFetch,
  CoreEventType.TakeoutConfirmResponse,
])

export function isClientEmittableCoreEvent(type: unknown): type is keyof ToCoreEvent {
  return typeof type === 'string' && CLIENT_EMITTABLE_CORE_EVENTS.has(type)
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
    meta?: WsEventMeta
  }
}[keyof WsEventToServer]

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
  if (!data)
    return { type, data: undefined } as Extract<WsMessageToClient, { type: T }>

  try {
    // ensure args[0] can be stringified
    const stringifiedData = JSON.stringify(data)
    if (stringifiedData.length > 1024 * 1024) {
      useLogger().withFields({ type, size: stringifiedData.length }).warn('Dropped event data')
      wsSendFailTotal.add(1, { reason: 'payload_too_large' })
      return { type, data: undefined } as Extract<WsMessageToClient, { type: T }>
    }

    return { type, data } as Extract<WsMessageToClient, { type: T }>
  }
  catch (err) {
    useLogger().withFields({ type }).withError(err).warn('Dropped event data')
    wsSendFailTotal.add(1, { reason: 'stringify_error' })

    return { type, data: undefined } as Extract<WsMessageToClient, { type: T }>
  }
}
