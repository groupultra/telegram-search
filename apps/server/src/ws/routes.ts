import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { App } from 'h3'

import type { WsMessageToServer } from './events'
import type { Peer } from './types'

import { useLogger } from '@guiiai/logg'
import { useConfig } from '@tg-search/common'
import { createCoreInstance, destroyCoreInstance } from '@tg-search/core'
import { defineWebSocketHandler } from 'h3'

import { sendWsEvent } from './events'

/**
 * Account state - one per Telegram account
 * Persists across WebSocket reconnections
 */
export interface AccountState {
  ctx: CoreContext
  phoneNumber?: string
  isConnected: boolean
  // Core event listeners (registered once, shared by all WebSocket connections)
  coreEventListeners: Map<keyof FromCoreEvent, (data: any) => void>
  // Active WebSocket peers for this account
  activePeers: Set<string>
  createdAt: number
  lastActive: number
}

export function setupWsRoutes(app: App) {
  const logger = useLogger('server:ws')

  // One AccountState per account (by accountId/sessionId)
  // This NEVER gets cleaned up (unless explicitly requested)
  const accountStates = new Map<string, AccountState>()

  // Transient per-peer data (cleaned up when WebSocket closes)
  const peerToAccountId = new Map<string, string>()

  /**
   * Get or create account state
   * Key principle: Account state is created once and reused
   */
  function getOrCreateAccount(accountId: string): AccountState {
    if (!accountStates.has(accountId)) {
      logger.withFields({ accountId }).log('Creating new account state')

      const ctx = createCoreInstance(useConfig())
      const account: AccountState = {
        ctx,
        isConnected: false,
        coreEventListeners: new Map(),
        activePeers: new Set(),
        createdAt: Date.now(),
        lastActive: Date.now(),
      }

      accountStates.set(accountId, account)
    }

    const account = accountStates.get(accountId)!
    account.lastActive = Date.now()
    return account
  }

  // We need to track peer objects for broadcasting
  const peerObjects = new Map<string, Peer>()

  app.use('/ws', defineWebSocketHandler({
    async upgrade(req) {
      const url = new URL(req.url)
      const urlSessionId = url.searchParams.get('sessionId')

      if (!urlSessionId) {
        return Response.json({ success: false, error: 'Session ID is required' }, { status: 400 })
      }
    },

    async open(peer) {
      const url = new URL(peer.request.url)
      const accountId = url.searchParams.get('sessionId') || crypto.randomUUID()

      logger.withFields({ peerId: peer.id, accountId }).log('WebSocket connection opened')

      // Get or create account state (reuses existing if available)
      const account = getOrCreateAccount(accountId)

      // Track this peer
      peerToAccountId.set(peer.id, accountId)
      account.activePeers.add(peer.id)
      peerObjects.set(peer.id, peer)

      logger.withFields({ accountId, activePeers: account.activePeers.size }).log('Peer added to account')

      sendWsEvent(peer, 'server:connected', { sessionId: accountId, connected: account.isConnected })
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

            // Register core event listener (shared, only once per account)
            if (!account.coreEventListeners.has(eventName)) {
              const listener = (...args: any[]) => {
                const data = args[0] // Extract data from event emitter args
                // Broadcast to ALL active peers of this account
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
          logger.withFields({ type: event.type, accountId }).log('Message received')

          // Emit to core context
          account.ctx.emitter.emit(event.type, event.data as CoreEventData<keyof ToCoreEvent>)
        }

        // Update account state based on events
        switch (event.type) {
          case 'auth:login':
            account.phoneNumber = event.data.phoneNumber
            account.ctx.emitter.once('auth:connected', () => {
              account.isConnected = true
            })
            break
          case 'auth:logout':
            account.isConnected = false
            // When user explicitly logs out, destroy the account
            logger.withFields({ accountId }).log('User logged out, destroying account')
            await destroyCoreInstance(account.ctx)
            accountStates.delete(accountId)
            // Disconnect all peers
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

      const accountId = peerToAccountId.get(peer.id)
      if (!accountId) {
        return
      }

      const account = accountStates.get(accountId)
      if (!account) {
        return
      }

      // Remove this peer from the account
      account.activePeers.delete(peer.id)
      peerToAccountId.delete(peer.id)
      peerObjects.delete(peer.id)

      logger.withFields({ accountId, remainingPeers: account.activePeers.size }).log('Peer removed from account')

      // DON'T clean up the account or CoreContext!
      // The account state persists even when all WebSocket connections are closed
      // This allows:
      // 1. Multiple tabs to share the same Telegram connection
      // 2. Background tasks to continue running
      // 3. Fast reconnection without re-authentication

      // Optional: Log when account has no active connections
      if (account.activePeers.size === 0) {
        logger.withFields({ accountId }).log('Account has no active connections, but keeping state alive')
      }
    },
  }))
}
