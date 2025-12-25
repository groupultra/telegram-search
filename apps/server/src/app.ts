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

import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { ExtractData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { H3 } from 'h3'

import type { AccountState } from './account'
import type { WsMessageToServer } from './events'

import { useLogger } from '@guiiai/logg'
import { destroyCoreInstance } from '@tg-search/core'
import { coreEventsInTotal, wsConnectionsActive } from '@tg-search/observability'
import { defineWebSocketHandler, HTTPError } from 'h3'
import { v4 as uuidv4 } from 'uuid'

import { accountStates, getOrCreateAccount, peerObjects, peerToAccountId } from './account'
import { sendWsEvent } from './events'

const WS_MODE_LABEL = 'server' as const

export function registerCoreEventListeners(logger: Logger, account: AccountState, accountId: string, eventName: keyof FromCoreEvent) {
  if (eventName.startsWith('server:')) {
    return
  }

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

export async function updateAccountState(logger: Logger, account: AccountState, accountId: string, eventName: keyof ToCoreEvent) {
  // Update account state based on events
  switch (eventName) {
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

export function setupWsRoutes(app: H3, config: Config) {
  const logger = useLogger('server:ws')

  app.get('/ws', defineWebSocketHandler({
    async upgrade(req) {
      const url = new URL(req.url)
      const urlSessionId = url.searchParams.get('sessionId')

      if (!urlSessionId || urlSessionId === '') {
        throw new HTTPError('Session ID is required', { status: 400 })
      }
    },

    async open(peer) {
      const url = new URL(peer.request.url)
      const accountId = url.searchParams.get('sessionId') || uuidv4()

      logger.withFields({ peerId: peer.id, accountId }).log('WebSocket connection opened')
      wsConnectionsActive.add(1, { mode: WS_MODE_LABEL })

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
          registerCoreEventListeners(logger, account, accountId, event.data.event as keyof FromCoreEvent)
          return
        }

        const tracingId = event.meta?.tracingId || uuidv4()

        logger.withFields({ type: event.type, accountId, tracingId }).verbose('Message received')

        if (!event.type.startsWith('server:')) {
          coreEventsInTotal.add(1, { event_name: event.type })
        }

        // Emit to core context (meta.tracingId is re-bound via emitter on/once wrappers)
        account.ctx.emitter.emit(event.type, { ...event.data, meta: { tracingId } } as ExtractData<keyof ToCoreEvent>)

        updateAccountState(logger, account, accountId, event.type as keyof ToCoreEvent)
      }
      catch (error) {
        logger.withError(error).error('Handle websocket message failed')
      }
    },

    async close(peer) {
      logger.withFields({ peerId: peer.id }).log('WebSocket connection closed')
      wsConnectionsActive.add(-1, { mode: WS_MODE_LABEL })

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
