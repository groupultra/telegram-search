/**
 * WebSocket Server for Telegram Search
 *
 * Architecture: Account-based State Management
 *
 * Problem Solved:
 * - Previous approach: Each WebSocket connection created its own CoreContext
 *   -> Event listeners duplicated on each reconnection
 *   -> Severe memory leaks (listeners accumulated indefinitely)
 *   -> Background tasks interrupted when tabs closed
 *
 * Solution:
 * - One AccountState per Telegram account (persistent)
 * - Multiple WebSocket connections share the same AccountState
 * - Event listeners registered once per account, not per connection
 * - Account persists until explicit logout
 *
 * Key Benefits:
 * 1. No memory leaks (listeners reused, not duplicated)
 * 2. Multi-tab support (all tabs share same Telegram connection)
 * 3. Background tasks (continue running when all tabs closed)
 * 4. Fast reconnection (no re-authentication needed)
 *
 * Lifecycle:
 * - Create: First WebSocket connection with new accountId
 * - Reuse: Subsequent connections with same accountId
 * - Persist: Even when all WebSocket connections close
 * - Destroy: Only when user explicitly logs out
 *
 * See PR #434 for detailed discussion and review comments
 */

import type { Config, CoreCounter, CoreHistogram, CoreMetrics } from '@tg-search/common'
import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'
import type { H3 } from 'h3'

import type { WsMessageToServer } from './ws-events'

import { useLogger } from '@guiiai/logg'
import { createCoreInstance, destroyCoreInstance } from '@tg-search/core'
import { defineWebSocketHandler } from 'h3'
import { Counter, Gauge, Histogram } from 'prom-client'
import { v4 as uuidv4 } from 'uuid'

import { getDb } from './storage/drizzle'
import { sendWsEvent } from './ws-events'

const WS_MODE_LABEL = 'server' as const

const wsConnectionsActive = new Gauge({
  name: 'ws_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['mode'] as const,
})

const coreEventsInTotal = new Counter({
  name: 'core_events_in_total',
  help: 'Total number of events sent from client to core',
  labelNames: ['event_name'] as const,
})

const coreMessagesProcessedTotal = new Counter({
  name: 'core_messages_processed_total',
  help: 'Total number of messages processed by core message resolver',
  labelNames: ['source'] as const, // realtime | takeout
})

const coreMessageBatchesProcessedTotal = new Counter({
  name: 'core_message_batches_processed_total',
  help: 'Total number of message batches processed by core message resolver',
  labelNames: ['source'] as const, // realtime | takeout
})

const coreMessageBatchDurationMs = new Histogram({
  name: 'core_message_batch_duration_ms',
  help: 'Duration of message processing batches in milliseconds',
  labelNames: ['source'] as const, // realtime | takeout
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
})

function createPromCounter(counter: Counter): CoreCounter {
  return {
    inc(labels?: Record<string, string>, value?: number) {
      if (labels) {
        counter.inc(labels as any, value)
      }
      else {
        counter.inc(value)
      }
    },
  }
}

function createPromHistogram(histogram: Histogram): CoreHistogram {
  return {
    observe(labels: Record<string, string>, value: number) {
      histogram.observe(labels as any, value)
    },
  }
}

const coreMetrics: CoreMetrics = {
  messagesProcessed: createPromCounter(coreMessagesProcessedTotal),
  messageBatchDuration: createPromHistogram(coreMessageBatchDurationMs),
}

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

export function setupWsRoutes(app: H3, config: Config) {
  const logger = useLogger('server:ws')

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
  const accountStates = new Map<string, AccountState>()

  /**
   * Transient state: Per-WebSocket-connection (ephemeral)
   *
   * These maps track temporary data that only exists while WebSocket is open
   * Cleaned up immediately when WebSocket closes
   */
  const peerToAccountId = new Map<string, string>()

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
  function getOrCreateAccount(accountId: string, config: Config): AccountState {
    if (!accountStates.has(accountId)) {
      logger.withFields({ accountId }).log('Creating new account state')

      const ctx = createCoreInstance(getDb, config, coreMetrics)
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
        coreMessageBatchesProcessedTotal.inc({ source })
        coreMessagesProcessedTotal.inc({ source }, messages.length)
      })

      accountStates.set(accountId, account)
      return account
    }

    const account = accountStates.get(accountId)!
    account.lastActive = Date.now()
    return account
  }

  // We need to track peer objects for broadcasting
  const peerObjects = new Map<string, Peer>()

  app.get('/ws', defineWebSocketHandler({
    async upgrade(req) {
      const url = new URL(req.url)
      const urlSessionId = url.searchParams.get('sessionId')

      if (!urlSessionId || urlSessionId === '') {
        return Response.json({ success: false, error: 'Session ID is required' }, { status: 400 })
      }
    },

    async open(peer) {
      const url = new URL(peer.request.url)
      const accountId = url.searchParams.get('sessionId') || uuidv4()

      logger.withFields({ peerId: peer.id, accountId }).log('WebSocket connection opened')
      wsConnectionsActive.inc({ mode: WS_MODE_LABEL })

      // Get or create account state (reuses existing if available)
      const account = getOrCreateAccount(accountId, config)

      // Track this peer
      peerToAccountId.set(peer.id, accountId)
      account.activePeers.add(peer.id)
      peerObjects.set(peer.id, peer)

      logger.withFields({ accountId, activePeers: account.activePeers.size }).log('Peer added to account')

      sendWsEvent(peer, 'server:connected', { sessionId: accountId, accountReady: account.accountReady })
    },

    async message(peer, message) {
      const accountId = peerToAccountId.get(peer.id)
      if (!accountId) {
        logger.withFields({ peerId: peer.id }).warn('Peer not associated with account')
        return
      }

      const account = accountStates.get(accountId)
      if (!account) {
        logger.withFields({ accountId }).warn('Account not found')
        return
      }

      const event = message.json<WsMessageToServer>()

      try {
        if (event.type === 'server:event:register') {
          if (!event.data.event.startsWith('server:')) {
            const eventName = event.data.event as keyof FromCoreEvent

            /**
             * Register core event listener (shared, only once per account)
             *
             * Critical for memory leak prevention:
             * - Listener is registered ONCE per account, not per WebSocket connection
             * - Multiple browser tabs share the same listener
             * - Listener broadcasts to ALL active peers (multi-tab sync)
             *
             * Why this prevents memory leaks:
             * - Old approach: Each WebSocket connection added a new listener
             *   -> 10 reconnections = 10 duplicate listeners = memory leak
             * - New approach: First connection adds listener, others reuse it
             *   -> 10 reconnections = still 1 listener = no leak
             *
             * Cleanup:
             * - Listener removed when account is destroyed (on logout)
             * - See destroyCoreInstance() -> ctx.cleanup() -> emitter.removeAllListeners()
             */
            if (!account.coreEventListeners.has(eventName)) {
              const listener = (...args: any[]) => {
                const data = args[0] // Extract data from event emitter args

                /**
                 * Broadcast to ALL active peers of this account
                 *
                 * Why broadcast to all?
                 * - User has 3 browser tabs open for same account
                 * - New message arrives from Telegram
                 * - All 3 tabs should show the new message (multi-tab sync)
                 *
                 * This is intentional behavior, not a bug
                 * See PR comment: "Broadcasting events to all peers"
                 */
                account.activePeers.forEach((peerId) => {
                  const targetPeer = peerObjects.get(peerId)
                  if (targetPeer) {
                    sendWsEvent(targetPeer, eventName, data)
                  }
                })
              }

              account.ctx.emitter.on(eventName, listener as any)
              account.coreEventListeners.set(eventName, listener as any)

              logger.withFields({ eventName, accountId }).debug('Registered shared core event listener')
            }
          }
        }
        else {
          logger.withFields({ type: event.type, accountId }).verbose('Message received')

          if (!event.type.startsWith('server:')) {
            coreEventsInTotal.inc({ event_name: event.type })
          }

          // Emit to core context
          account.ctx.emitter.emit(event.type, event.data as CoreEventData<keyof ToCoreEvent>)
        }

        // Update account state based on events
        switch (event.type) {
          case 'auth:login':
            account.ctx.emitter.once('account:ready', () => {
              account.accountReady = true
            })
            break
          case 'auth:logout':
            account.accountReady = false

            /**
             * Explicit logout: The ONLY time we destroy an account
             *
             * What happens:
             * 1. Emit 'core:cleanup' event -> Services clean up (e.g., Telegram event handlers)
             * 2. Wait 100ms for async cleanup to complete
             * 3. Disconnect Telegram Client
             * 4. Call ctx.cleanup() -> Remove all event listeners
             * 5. Delete account from accountStates map
             * 6. Close all WebSocket connections for this account
             *
             * Why only on explicit logout?
             * - Closing browser tabs should NOT destroy account (supports background tasks)
             * - Network disconnection should NOT destroy account (supports fast reconnection)
             * - Only user's intentional "Logout" action should destroy account
             *
             * Memory Safety:
             * - destroyCoreInstance() properly cleans up all resources
             * - Event listeners removed (no leak)
             * - Telegram Client disconnected (no hanging connection)
             * - CoreContext released (GC can reclaim memory)
             */
            logger.withFields({ accountId }).log('User logged out, destroying account')
            await destroyCoreInstance(account.ctx)
            accountStates.delete(accountId)

            // Disconnect all peers for this account
            account.activePeers.forEach((peerId) => {
              peerObjects.get(peerId)?.close()
            })
            break
        }
      }
      catch (error) {
        logger.withError(error).error('Handle websocket message failed')
      }
    },

    async close(peer) {
      logger.withFields({ peerId: peer.id }).log('WebSocket connection closed')
      wsConnectionsActive.dec({ mode: WS_MODE_LABEL })

      const accountId = peerToAccountId.get(peer.id)
      if (!accountId) {
        return
      }

      const account = accountStates.get(accountId)
      if (!account) {
        return
      }

      // Remove this peer from the account (cleanup transient state)
      account.activePeers.delete(peer.id)
      peerToAccountId.delete(peer.id)
      peerObjects.delete(peer.id)

      logger.withFields({ accountId, remainingPeers: account.activePeers.size }).log('Peer removed from account')

      /**
       * CRITICAL ARCHITECTURAL DECISION: DO NOT clean up the account!
       *
       * Why account persists after all WebSocket connections close:
       *
       * 1. Multi-tab Support
       *    - User opens 3 tabs, closes 2 -> Account should remain for the 3rd tab
       *    - Cleaning up would break the remaining tab
       *
       * 2. Background Tasks
       *    - User starts syncing 100k messages, closes browser
       *    - Sync should continue running in background
       *    - Cleaning up would interrupt the sync
       *
       * 3. Fast Reconnection
       *    - Network hiccup causes temporary disconnect
       *    - Browser automatically reconnects
       *    - Reusing account state = instant reconnection, no re-auth needed
       *
       * 4. Memory Leak Prevention
       *    - Old approach: Cleanup on disconnect caused issues
       *      - What if user reconnects in 1 second? Wasted cleanup effort
       *      - Complex timer logic prone to race conditions
       *    - New approach: No cleanup, no complexity, no bugs
       *      - Account cleaned up ONLY on explicit logout
       *      - Clean, simple, predictable behavior
       *
       * Trade-offs:
       * - Pro: Robustness, simplicity, user-friendly behavior
       * - Con: Memory grows with number of unique accounts
       * - Mitigation: Most servers have < 100 concurrent accounts, negligible memory impact
       *
       * Future Enhancement (if needed):
       * - Optional TTL-based cleanup for inactive accounts (e.g., 7 days)
       * - Admin API to manually purge inactive accounts
       * - Monitoring dashboard to track account count and memory usage
       *
       * Related PR Comments:
       * - Copilot: "Consider implementing a timeout-based cleanup"
       * - Gemini: "Consider implementing a TTL mechanism"
       * - Decision: Deferred to future, current approach is sufficient
       */

      // Log when account has no active connections (for monitoring/debugging)
      if (account.activePeers.size === 0) {
        logger.withFields({ accountId }).log('Account has no active connections, but keeping state alive for background tasks and fast reconnection')
      }
    },
  }))
}
