import type { Config } from '@tg-search/common'
import type { CoreContext, CoreEmitter, FromCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

import { useLogger } from '@guiiai/logg'
import { createCoreInstance } from '@tg-search/core'
import { coreMessageBatchesProcessedTotal, coreMessagesProcessedTotal, coreMetrics, withSpan } from '@tg-search/observability'

import { getDB } from './storage/drizzle'
import { getMinioMediaStorage } from './storage/minio'

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

/**
 * Primary state: Account-based (persistent)
 *
 * Key: accountId (from WebSocket URL ?sessionId=xxx)
 * Value: AccountState with CoreContext, Telegram Client, event listeners
 *
 * Lifecycle: Created once, reused forever, destroyed only on explicit logout
 *
 * Why persistent?
 * 1. Support multiple browser tabs sharing same Telegram connection
 * 2. Allow background tasks to continue when all tabs closed
 * 3. Enable fast reconnection without re-authentication
 * 4. Prevent memory leaks by reusing event listeners
 */
export const accountStates = new Map<string, AccountState>()

/**
 * Transient state: Per-WebSocket-connection (ephemeral)
 *
 * These maps track temporary data that only exists while WebSocket is open
 * Cleaned up immediately when WebSocket closes
 */
export const peerToAccountId = new Map<string, string>()

/**
 * Get or create account state
 *
 * Key principle: Account state is created once and reused
 *
 * Flow:
 * 1. First WebSocket connection with accountId "abc" -> Create new AccountState
 * 2. Open second tab with same accountId "abc" -> Reuse existing AccountState
 * 3. Close first tab -> AccountState remains (second tab still connected)
 * 4. Close second tab -> AccountState still remains (supports background tasks)
 * 5. User clicks "Logout" -> AccountState destroyed via destroyCoreInstance()
 *
 * Memory Safety:
 * - Event listeners registered only once per account (not per connection)
 * - Listeners properly cleaned up on logout via ctx.cleanup()
 * - No listener accumulation = no memory leak
 */

// We need to track peer objects for broadcasting
export const peerObjects = new Map<string, Peer>()

function bindTracingMetaToSpan(emitter: CoreEmitter) {
  // Ensure tracingId from incoming meta is bound into active span for all core handlers
  const originalOn = emitter.on.bind(emitter)
  emitter.on = ((event, listener) => {
    return originalOn(event, (...args: Parameters<typeof listener>) => {
      return withSpan(String(event), () => listener(...args))
    })
  }) as CoreEmitter['on']

  const originalOnce = emitter.once.bind(emitter)
  emitter.once = ((event, listener) => {
    return originalOnce(event, (...args: Parameters<typeof listener>) => {
      return withSpan(String(event), () => listener(...args))
    })
  }) as CoreEmitter['once']
}

export function getOrCreateAccount(accountId: string, config: Config): AccountState {
  const logger = useLogger('server:account')

  if (!accountStates.has(accountId)) {
    logger.withFields({ accountId }).log('Creating new account state')

    const ctx = createCoreInstance(getDB, config, getMinioMediaStorage(), logger, coreMetrics)

    bindTracingMetaToSpan(ctx.emitter)

    const account: AccountState = {
      ctx,
      accountReady: false,
      coreEventListeners: new Map(),
      activePeers: new Set(),
      createdAt: Date.now(),
      lastActive: Date.now(),
    }

    // Instrument core message processing for this account
    ctx.emitter.on('message:process', ({ messages, isTakeout }) => {
      const source = isTakeout ? 'takeout' : 'realtime'
      coreMessageBatchesProcessedTotal.add(1, { source })
      coreMessagesProcessedTotal.add(messages.length, { source })
    })

    accountStates.set(accountId, account)
    return account
  }

  const account = accountStates.get(accountId)!
  account.lastActive = Date.now()
  return account
}
