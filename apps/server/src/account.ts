import type { Config } from '@tg-search/common'
import type { CoreContext, CoreEmitter, FromCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

import { useLogger } from '@guiiai/logg'
import { attachBotToContext, getBotRegistry } from '@tg-search/bot'
import { CoreEventType, createCoreInstance } from '@tg-search/core'
import { coreMessageBatchesProcessedTotal, coreMessagesProcessedTotal, coreMetrics, withSpan } from '@tg-search/observability'

import { getDB } from './storage/drizzle'
import { getMediaStorage } from './storage/media'

/**
 * Account-scoped runtime state.
 *
 * Decision:
 * - Keep one CoreContext per account ID and share it across peers.
 * Constraints:
 * - Account state is destroyed only on explicit logout.
 * Risks:
 * - Long-lived accounts increase memory usage; monitor active account count.
 */
export type CoreEventListener = (...args: unknown[]) => void

export interface AccountState {
  ctx: CoreContext

  /**
   * Whether the account is ready to be used
   */
  accountReady: boolean

  /**
   * Core event listeners (registered once, shared by all WebSocket connections)
   */
  coreEventListeners: Map<keyof FromCoreEvent, CoreEventListener>

  /**
   * Pending AccountReady listener for the current login attempt.
   * This is replaced on every AuthLogin to avoid stacking one-time listeners
   * across retries/timeouts.
   */
  pendingReadyListener?: CoreEventListener

  /**
   * Active WebSocket peers for this account
   */
  activePeers: Set<string>

  createdAt: number

  lastActive: number
}

// Persistent account map keyed by session/account id.
export const accountStates = new Map<string, AccountState>()

// Ephemeral per-peer bookkeeping.
export const peerToAccountId = new Map<string, string>()

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

    const ctx = createCoreInstance(getDB, config, getMediaStorage(), logger, coreMetrics)

    bindTracingMetaToSpan(ctx.emitter)

    const account: AccountState = {
      ctx,
      accountReady: false,
      coreEventListeners: new Map(),
      pendingReadyListener: undefined,
      activePeers: new Set(),
      createdAt: Date.now(),
      lastActive: Date.now(),
    }

    // Instrument core message processing for this account
    ctx.emitter.on(CoreEventType.MessageProcess, ({ messages, isTakeout }) => {
      const source = isTakeout ? 'takeout' : 'realtime'
      coreMessageBatchesProcessedTotal.add(1, { source })
      coreMessagesProcessedTotal.add(messages.length, { source })
    })

    // Bridge bot events to shared bot registry (if bot is enabled)
    const botRegistry = getBotRegistry()
    if (botRegistry) {
      attachBotToContext(botRegistry, account.ctx, accountId, logger)
    }

    accountStates.set(accountId, account)
    return account
  }

  const account = accountStates.get(accountId)!
  account.lastActive = Date.now()
  return account
}

export function getAccountContext(accountId: string): CoreContext | undefined {
  return accountStates.get(accountId)?.ctx
}
