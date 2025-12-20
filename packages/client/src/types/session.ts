import type { CoreUserEntity } from '@tg-search/core'

/**
 * Persistent session representation in localStorage.
 * Flattens metadata and core session info.
 */
export interface StoredSession {
  uuid: string

  /**
   * @deprecated Use account store's isReady instead
   */
  isConnected?: boolean

  me?: CoreUserEntity

  /**
   * Telegram StringSession managed on the client side.
   * Core never persists this; it only forwards updated values.
   */
  session?: string
}

// Deprecated alias for backward compatibility during refactor, if needed
export type SessionContext = Partial<Omit<StoredSession, 'uuid'>>
