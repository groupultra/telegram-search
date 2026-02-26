/**
 * WebSocket bridge for account-scoped CoreContext instances.
 *
 * Decision:
 * - Route all peers with the same sessionId to one account state.
 * Constraints:
 * - Keep account state alive across reconnects and tab closures.
 * Risks:
 * - State growth is tied to unique account count.
 */

import type { Logger } from '@guiiai/logg'
import type { Config } from '@tg-search/common'
import type { ExtractData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { H3 } from 'h3'

import type { AccountState, CoreEventListener } from './account'
import type { WsEventToClientData, WsMessageToServer } from './events'

import { useLogger } from '@guiiai/logg'
import { CoreEventType, destroyCoreInstance } from '@tg-search/core'
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

  if (!account.coreEventListeners.has(eventName)) {
    const listener: CoreEventListener = (...args: unknown[]) => {
      const data = args[0] as WsEventToClientData<typeof eventName>
      account.activePeers.forEach((peerId) => {
        const targetPeer = peerObjects.get(peerId)
        if (targetPeer) {
          sendWsEvent(targetPeer, eventName, data)
        }
      })
    }

    account.ctx.emitter.on(eventName, listener)
    account.coreEventListeners.set(eventName, listener)

    logger.withFields({ eventName, accountId }).debug('Registered shared core event listener')
  }
}

export async function updateAccountState(logger: Logger, account: AccountState, accountId: string, eventName: keyof ToCoreEvent) {
  // Update account state based on events
  switch (eventName) {
    case CoreEventType.AuthLogin:
      account.ctx.emitter.once(CoreEventType.AccountReady, () => {
        account.accountReady = true
      })
      break
    case CoreEventType.AuthLogout:
      account.accountReady = false
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
      const account = await getOrCreateAccount(accountId, config)

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
