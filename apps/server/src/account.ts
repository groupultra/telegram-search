import type { Config } from '@tg-search/common'
import type { CoreContext, FromCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'

import { useLogger } from '@guiiai/logg'
import { attachBotToContext, getBotRegistry } from '@tg-search/bot'
import { createCoreInstance, MessageProcess, safeOn } from '@tg-search/core'
import { coreMessageBatchesProcessedTotal, coreMessagesProcessedTotal, coreMetrics } from '@tg-search/observability'

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
export type CoreEventListener = (data: unknown) => void

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

export function getOrCreateAccount(accountId: string, config: Config): AccountState {
  const logger = useLogger('server:account')

  if (!accountStates.has(accountId)) {
    logger.withFields({ accountId }).log('Creating new account state')

    const ctx = createCoreInstance(getDB, config, getMediaStorage(), logger, coreMetrics)

    const account: AccountState = {
      ctx,
      accountReady: false,
      coreEventListeners: new Map(),
      activePeers: new Set(),
      createdAt: Date.now(),
      lastActive: Date.now(),
    }

    // Instrument core message processing for this account
    safeOn(ctx.eventContext, MessageProcess, ({ messages, isTakeout }) => {
      const source = isTakeout ? 'takeout' : 'realtime'
      coreMessageBatchesProcessedTotal.add(1, { source })
      coreMessagesProcessedTotal.add(messages.length, { source })
    }, logger)

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
