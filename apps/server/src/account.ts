import type { Eventa } from '@moeru/eventa'
import type { Config } from '@tg-search/common'
import type { CoreContext } from '@tg-search/core'
import type { Peer } from 'crossws'

import { useLogger } from '@guiiai/logg'
import { attachBotToContext, getBotRegistry } from '@tg-search/bot'
import {
  // Notification events from core (broadcast to all peers)
  accountReadyEvent,
  authCodeNeededEvent,
  authConnectedEvent,
  authDisconnectedEvent,
  authErrorEvent,
  authPasswordNeededEvent,
  botStatusEvent,
  coreErrorEvent,
  createCoreInstance,
  dialogAvatarDataEvent,
  entityAvatarDataEvent,
  entityMeDataEvent,
  gramMessageReceivedEvent,
  messageDataEvent,
  messageFetchProgressEvent,
  messageProcessEvent,
  onEvent,
  sessionUpdateEvent,
  syncStatusEvent,
  takeoutMetricsEvent,
  takeoutTaskProgressEvent,
} from '@tg-search/core'
import { coreMessageBatchesProcessedTotal, coreMessagesProcessedTotal, coreMetrics } from '@tg-search/observability'

import { sendWsEvent } from './events'
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
export interface AccountState {
  ctx: CoreContext

  /**
   * Whether the account is ready to be used
   */
  accountReady: boolean

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

// NOTICE: peerObjects is populated in app.ts (WebSocket open/close handlers).
// The sonarjs/no-empty-collection rule cannot track cross-file mutations.

export const peerObjects = new Map<string, Peer>()

/**
 * All notification events from core that should be broadcast to WebSocket peers.
 * Each entry maps a typed Eventa event to its wire protocol event name.
 */
const notificationEvents: Array<{ event: Eventa<any>, wireName: string }> = [
  { event: coreErrorEvent, wireName: 'core:error' },
  { event: authCodeNeededEvent, wireName: 'auth:code:needed' },
  { event: authPasswordNeededEvent, wireName: 'auth:password:needed' },
  { event: authConnectedEvent, wireName: 'auth:connected' },
  { event: authDisconnectedEvent, wireName: 'auth:disconnected' },
  { event: authErrorEvent, wireName: 'auth:error' },
  { event: sessionUpdateEvent, wireName: 'session:update' },
  { event: accountReadyEvent, wireName: 'account:ready' },
  { event: messageDataEvent, wireName: 'message:data' },
  { event: messageFetchProgressEvent, wireName: 'message:fetch:progress' },
  { event: dialogAvatarDataEvent, wireName: 'dialog:avatar:data' },
  { event: entityMeDataEvent, wireName: 'entity:me:data' },
  { event: entityAvatarDataEvent, wireName: 'entity:avatar:data' },
  { event: takeoutTaskProgressEvent, wireName: 'takeout:task:progress' },
  { event: takeoutMetricsEvent, wireName: 'takeout:metrics' },
  { event: gramMessageReceivedEvent, wireName: 'gram:message:received' },
  { event: botStatusEvent, wireName: 'bot:status' },
  { event: syncStatusEvent, wireName: 'sync:status' },
]

/**
 * Register all notification event listeners on the core context.
 * Each notification is broadcast to all active WebSocket peers for this account.
 */
function registerNotificationListeners(account: AccountState) {
  for (const { event, wireName } of notificationEvents) {
    onEvent(account.ctx.ctx, event, (body) => {
      account.activePeers.forEach((peerId) => {
        // eslint-disable-next-line sonarjs/no-empty-collection -- peerObjects is populated in app.ts
        const targetPeer = peerObjects.get(peerId)
        if (targetPeer) {
          sendWsEvent(targetPeer, wireName, body)
        }
      })
    })
  }
}

export function getOrCreateAccount(accountId: string, config: Config): AccountState {
  const logger = useLogger('server:account')

  if (!accountStates.has(accountId)) {
    logger.withFields({ accountId }).log('Creating new account state')

    const ctx = createCoreInstance(getDB, config, getMediaStorage(), logger, coreMetrics)

    const account: AccountState = {
      ctx,
      accountReady: false,
      activePeers: new Set(),
      createdAt: Date.now(),
      lastActive: Date.now(),
    }

    // Register all notification listeners upfront (replaces server:event:register protocol)
    registerNotificationListeners(account)

    // Instrument core message processing for this account
    onEvent(ctx.ctx, messageProcessEvent, ({ messages, isTakeout }) => {
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
