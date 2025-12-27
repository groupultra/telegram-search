import type {
  WsEventToClient,
  WsEventToClientData,
  WsEventToServer,
  WsEventToServerData,
  WsMessageToServer,
} from '@tg-search/server/types'

import type { StoredSession } from '../stores'

export type ClientSendEventFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => void
export type ClientCreateWsMessageFn = <T extends keyof WsEventToServer>(event: T, data?: WsEventToServerData<T>) => WsMessageToServer

export interface BridgeStore {
  init?: () => void
  sessions: Record<string, StoredSession>
  activeSessionId: string
  activeSession: StoredSession | undefined
  switchAccount: (sessionId: string) => void
  applySessionUpdate: (session: string) => void
  logoutCurrentAccount: () => Promise<void>
  sendEvent: ClientSendEventFn
  waitForEvent: <T extends keyof WsEventToClient>(event: T) => Promise<WsEventToClientData<T>>
}
