import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { App, EventHandler } from 'h3'

import type { WsEventToClientData, WsMessageToServer } from './events'

import { createCoreInstance } from '@tg-search/core'
import { useLogger } from '@unbird/logg'
import { defineWebSocketHandler } from 'h3'

import { sendWsEvent } from './events'

export interface ClientState {
  ctx?: CoreContext

  isConnected: boolean
  phoneNumber?: string
}

type EventListener = <T extends keyof FromCoreEvent>(data: WsEventToClientData<T>) => void

// H3 does not export the Peer type directly, so we extract it from the `message` hook of the WebSocket event handler.
type Hooks = NonNullable<EventHandler['__websocket__']>
export type Peer = Parameters<NonNullable<Hooks['message']>>[0]

export function setupWsRoutes(app: App) {
  const logger = useLogger('server:ws')
  const clientStatesBySession = new Map<string, ClientState>()
  const eventListenersByPeer = new Map<string, Map<keyof FromCoreEvent, EventListener>>()

  function useSessionId(peer: Peer) {
    const url = new URL(peer.request.url)
    const urlSessionId = url.searchParams.get('sessionId')
    return urlSessionId || crypto.randomUUID()
  }

  function updatePeerSessionState(peer: Peer) {
    const sessionId = useSessionId(peer)
    let state: ClientState

    if (!clientStatesBySession.has(sessionId)) {
      logger.withFields({ sessionId }).log('Session created')

      const ctx = createCoreInstance()
      state = {
        ctx,
        isConnected: false,
      }

      clientStatesBySession.set(sessionId, state)
    }
    else {
      logger.withFields({ sessionId }).log('Session restored')

      state = clientStatesBySession.get(sessionId)!
    }

    return {
      sessionId,
      state,
    }
  }

  function usePeerSessionState(peer: Peer) {
    const sessionId = useSessionId(peer)

    return {
      sessionId,
      state: clientStatesBySession.get(sessionId)!,
    }
  }

  app.use('/ws', defineWebSocketHandler({
    async upgrade(req) {
      const url = new URL(req.url)
      const urlSessionId = url.searchParams.get('sessionId')

      if (!urlSessionId) {
        return Response.json({ success: false, error: 'Session ID is required' }, { status: 400 })
      }
    },

    async open(peer) {
      const { state, sessionId } = updatePeerSessionState(peer)

      logger.withFields({ peerId: peer.id }).log('Websocket connection opened')

      sendWsEvent(peer, 'server:connected', { sessionId, connected: state.isConnected })

      if (!eventListenersByPeer.has(peer.id)) {
        eventListenersByPeer.set(peer.id, new Map())
      }
    },

    async message(peer, message) {
      const { state } = usePeerSessionState(peer)

      const event = message.json<WsMessageToServer>()

      try {
        if (event.type === 'server:event:register') {
          if (!event.data.event.startsWith('server:')) {
            const eventName = event.data.event as keyof FromCoreEvent

            const fn = (data: WsEventToClientData<keyof FromCoreEvent>) => {
              logger.withFields({ eventName }).debug('Sending event to client')
              sendWsEvent(peer, eventName, data)
            }

            state.ctx?.emitter.on(eventName, fn as any)
            eventListenersByPeer.get(peer.id)?.set(eventName, fn)
          }
        }
        else {
          logger.withFields({ type: event.type }).log('Message received')

          state.ctx?.emitter.emit(event.type, event.data as CoreEventData<keyof ToCoreEvent>)
        }

        switch (event.type) {
          case 'auth:login':
            state.phoneNumber = event.data.phoneNumber
            state.ctx?.emitter.once('auth:connected', () => {
              state.isConnected = true
            })
            break
          case 'auth:logout':
            state.isConnected = false
            break
        }
      }
      catch (error) {
        logger.withError(error).error('Handle websocket message failed')
      }
    },

    close(peer) {
      logger.withFields({ peerId: peer.id }).log('Websocket connection closed')

      const { state } = usePeerSessionState(peer)
      eventListenersByPeer.get(peer.id)?.forEach((fn, eventName) => {
        state.ctx?.emitter.removeListener(eventName, fn as any)
      })
    },
  }))
}
