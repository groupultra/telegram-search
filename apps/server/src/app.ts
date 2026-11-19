/**
 * WebSocket bridge for account-scoped CoreContext instances.
 *
 * Decision:
 * - Route all peers with the same sessionId to one account state.
 * - Every frame is an Eventa frame. The UI reaches core only through the
 *   contracts in `@tg-search/core` `ui/contracts`; there is no generic path
 *   from a client frame to the core event emitter.
 * Constraints:
 * - Keep account state alive across reconnects and tab closures.
 * Risks:
 * - State growth is tied to unique account count.
 */

import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { SignInTicketResult, TelegramApplicationRuntime, UiCoreNotificationType, UiNotificationData } from '@tg-search/core'
import type { Peer } from 'crossws'
import type { H3 } from 'h3'

import type { AccountState } from './account'

import { useLogger } from '@guiiai/logg'
import { defineInvokeHandler } from '@moeru/eventa'
import { createPeerContext } from '@moeru/eventa/adapters/websocket/h3'
import {
  CoreEventType,
  createTelegramApplicationRuntime,
  destroyCoreInstance,
  registerApplicationHandlers,
  registerUiHandlers,
  signInTicketContract,
  UI_HEARTBEAT_PING,
  UI_HEARTBEAT_PONG,
  uiNotificationContracts,
} from '@tg-search/core'
import { coreEventsInTotal, wsConnectionsActive, wsSendFailTotal } from '@tg-search/observability'
import { defineWebSocketHandler } from 'h3'
import { v4 as uuidv4 } from 'uuid'

import { accountStates, getOrCreateAccount, peerObjects, peerToAccountId } from './account'

const WS_MODE_LABEL = 'server' as const
const MAX_NOTIFICATION_BYTES = 1024 * 1024

type EventaPeer = Parameters<typeof createPeerContext>[0]
type PeerEventa = ReturnType<typeof createPeerContext>

interface PeerRpcState {
  eventa: PeerEventa
  unregisterUi: () => void
  runtime?: TelegramApplicationRuntime
  unregister?: () => void
}

const peerRpcStates = new Map<string, PeerRpcState>()

// NOTICE: H3 and Eventa resolve nominally distinct crossws Peer declarations
// from the same runtime version. The objects are runtime-compatible, but the
// private class field prevents TypeScript structural assignment.
function asEventaPeer(peer: Peer): EventaPeer {
  return peer as unknown as EventaPeer
}

function ensurePeerApplication(account: AccountState, peerId: string) {
  const state = peerRpcStates.get(peerId)
  if (!state || state.runtime || !account.accountReady)
    return

  state.runtime = createTelegramApplicationRuntime({ context: account.ctx, logger: useLogger('server:application') })
  state.unregister = registerApplicationHandlers(state.eventa.context, state.runtime)
}

/**
 * An account-scoped context already has an authorized Telegram client.
 * Replaying auth:login from another tab must not create and replace it, so a
 * ready account answers with account:ready instead.
 */
export function respondToReadyLogin(eventa: PeerEventa['context'], account: AccountState): boolean {
  if (!account.accountReady) {
    return false
  }

  void eventa.emit(uiNotificationContracts[CoreEventType.AccountReady], { accountId: account.ctx.getCurrentAccountId() })
  return true
}

export async function updateAccountState(logger: Logger, account: AccountState, accountId: string, eventName: string) {
  if (eventName !== CoreEventType.AuthLogout)
    return

  account.accountReady = false
  logger.withFields({ accountId }).log('User logged out, destroying account')
  await destroyCoreInstance(account.ctx)
  accountStates.delete(accountId)

  account.activePeers.forEach((peerId) => {
    peerObjects.get(peerId)?.close()
  })
}

/**
 * Drops notification data that is too large or cannot be serialized, so a
 * single oversized payload cannot stall the socket. The client still gets
 * the event, without data.
 */
export function limitNotificationSize<T extends UiCoreNotificationType>(type: T, data: UiNotificationData<T>): UiNotificationData<T> {
  if (data === undefined)
    return data
  const logger = useLogger('server:ws')
  try {
    const size = JSON.stringify(data)?.length ?? 0
    if (size <= MAX_NOTIFICATION_BYTES)
      return data
    logger.withFields({ type, size }).warn('Dropped event data')
    wsSendFailTotal.add(1, { reason: 'payload_too_large' })
  }
  catch (error) {
    logger.withFields({ type }).withError(error).warn('Dropped event data')
    wsSendFailTotal.add(1, { reason: 'stringify_error' })
  }
  return undefined as UiNotificationData<T>
}

/**
 * Accepts only Eventa frames. The Eventa peer adapter answers a frame it
 * cannot parse by logging it and emitting its own error event, which it then
 * sends back to the client; drop such frames here instead.
 */
export function isEventaFrameText(text: string): boolean {
  try {
    const frame = JSON.parse(text) as { deliveryId?: unknown, eventa?: { id?: unknown } } | null
    return typeof frame?.deliveryId === 'string' && typeof frame.eventa?.id === 'string'
  }
  catch {
    return false
  }
}

export interface WsRouteOptions {
  /** Rejects the upgrade by throwing a `Response`; unset in the single-user mode. */
  authorize?: (request: Request) => Promise<void>
  /** Issues a sign-in ticket for a Telegram account logged in on this server; unset in the single-user mode. */
  issueSignInTicket?: (identity: { telegramId: string, name?: string }) => Promise<string>
}

/**
 * Answers a sign-in ticket request. Only a session whose Telegram account is
 * logged in and ready gets one; the ticket names that account's own user.
 */
export async function issueSignInTicketFor(account: AccountState | undefined, issue: WsRouteOptions['issueSignInTicket'], logger: Logger): Promise<SignInTicketResult> {
  if (!issue)
    return { error: 'OAUTH_DISABLED' }
  if (!account?.accountReady)
    return { error: 'ACCOUNT_NOT_READY' }
  try {
    const me = account.ctx.getMyUser()
    const ticket = await issue({ telegramId: String(me.id), name: me.name || me.username || undefined })
    return { ticket }
  }
  catch (error) {
    logger.withError(error).error('Failed to issue a sign-in ticket')
    return { error: 'TICKET_FAILED' }
  }
}

export function setupWsRoutes(app: H3, config: Config, options: WsRouteOptions = {}) {
  const logger = useLogger('server:ws')

  app.get('/ws', defineWebSocketHandler({
    async upgrade(req) {
      const url = new URL(req.url)
      const urlSessionId = url.searchParams.get('sessionId')

      // crossws aborts an upgrade only on a thrown Response; an HTTPError became a 500.
      if (!urlSessionId || urlSessionId === '') {
        throw new Response('Session ID is required', { status: 400 })
      }

      await options.authorize?.(req)
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

      const eventa = createPeerContext(asEventaPeer(peer))
      const unregisterUi = registerUiHandlers(eventa.context, account.ctx, {
        logger,
        onCommand: (type, input, forward) => {
          if (type === CoreEventType.AuthLogin && respondToReadyLogin(eventa.context, account))
            return

          logger.withFields({ type, accountId }).verbose('Command received')
          coreEventsInTotal.add(1, { event_name: type })
          forward(input)
          void updateAccountState(logger, account, accountId, type)
        },
        prepareNotification: limitNotificationSize,
      })
      defineInvokeHandler(eventa.context, signInTicketContract, () => issueSignInTicketFor(accountStates.get(accountId), options.issueSignInTicket, logger))
      peerRpcStates.set(peer.id, { eventa, unregisterUi })

      logger.withFields({ accountId, activePeers: account.activePeers.size }).log('Peer added to account')

      void eventa.context.emit(uiNotificationContracts['server:connected'], { sessionId: accountId, accountReady: account.accountReady })
    },

    async message(peer, message) {
      if (message.text() === UI_HEARTBEAT_PING) {
        peer.send(UI_HEARTBEAT_PONG)
        return
      }

      const accountId = peerToAccountId.get(peer.id)
      const account = accountId ? accountStates.get(accountId) : undefined
      const rpcState = peerRpcStates.get(peer.id)
      if (!account || !rpcState) {
        logger.withFields({ peerId: peer.id, accountId }).warn('Peer not associated with account')
        return
      }

      if (!isEventaFrameText(message.text())) {
        logger.withFields({ peerId: peer.id, accountId }).warn('Dropped a WebSocket frame that is not an Eventa frame')
        return
      }

      try {
        ensurePeerApplication(account, peer.id)
        await rpcState.eventa.hooks.message(asEventaPeer(peer), message as never)
      }
      catch (error) {
        logger.withError(error).error('Handle websocket message failed')
      }
    },

    async close(peer) {
      logger.withFields({ peerId: peer.id }).log('WebSocket connection closed')
      wsConnectionsActive.add(-1, { mode: WS_MODE_LABEL })

      const rpcState = peerRpcStates.get(peer.id)
      if (rpcState) {
        peerRpcStates.delete(peer.id)
        rpcState.unregisterUi()
        rpcState.unregister?.()
        await rpcState.runtime?.dispose()
        await rpcState.eventa.hooks.close(asEventaPeer(peer), {})
      }

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

      // Decision: keep account state alive when peers disconnect.
      // Constraint: only explicit logout can destroy account runtime state.
      // Risk: memory footprint grows with long-lived account IDs.

      // Log when account has no active connections (for monitoring/debugging)
      if (account.activePeers.size === 0) {
        logger.withFields({ accountId }).log('Account has no active connections, but keeping state alive for background tasks and fast reconnection')
      }
    },
  }))
}
