import type { CoreContext, FromCoreEvent } from '@tg-search/core'

/**
 * Account state - one per Telegram account
 *
 * Architecture Decision:
 * - ONE AccountState per Telegram account (by accountId/sessionId)
 * - PERSISTS across WebSocket reconnections
 * - SHARED by multiple browser tabs/windows
 *
 * Lifecycle:
 * - Created: On first WebSocket connection with a new accountId
 * - Reused: Subsequent connections with the same accountId
 * - Destroyed: Only when user explicitly logs out (auth:logout event)
 *
 * Memory Management:
 * - Event listeners registered ONCE per account, not per WebSocket connection
 * - This prevents memory leaks from listener accumulation
 * - All listeners cleaned up on explicit logout via destroyCoreInstance()
 *
 * Benefits:
 * 1. Multiple tabs share same Telegram connection (no re-authentication)
 * 2. Background tasks continue running even when all tabs closed
 * 3. Fast reconnection (state preserved)
 * 4. No memory leaks (listeners reused, not duplicated)
 *
 * Trade-offs:
 * - Accounts persist indefinitely until explicit logout
 * - Server memory usage grows with number of unique accounts
 * - Acceptable for typical use cases (limited number of accounts per server)
 *
 * Future Enhancement:
 * - Optional TTL-based cleanup for inactive accounts
 * - Admin API to list/manage active accounts
 */
export interface AccountState {
  ctx: CoreContext

  /**
   * Whether the account is ready to be used
   */
  accountReady: boolean

  /**
   * Core event listeners (registered once, shared by all WebSocket connections)
   */
  coreEventListeners: Map<keyof FromCoreEvent, (data: any) => void>

  /**
   * Active WebSocket peers for this account
   */
  activePeers: Set<string>

  createdAt: number

  lastActive: number
}
