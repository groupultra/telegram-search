import type { CoreUserEntity } from '@tg-search/core'

export interface SessionContext {
  isConnected?: boolean
  me?: CoreUserEntity
  /**
   * Telegram StringSession managed on the client side.
   * Core never persists this; it only forwards updated values.
   */
  session?: string
}

/**
 * Persistent session representation in localStorage for browser-core mode.
 *
 * Shape is intentionally kept in sync with websocket adapter:
 * - uuid: stable identifier
 * - metadata: UI-related context
 * - sessionString: raw Telegram session string (if/when needed)
 */
export interface StoredSession {
  uuid: string
  metadata: SessionContext
  sessionString?: string
}
