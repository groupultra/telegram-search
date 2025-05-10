import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'
import type { App } from 'h3'
import type { UUID } from 'node:crypto'
import type { WsEventToClientData, WsMessageToServer } from './ws-event'

import { useLogger } from '@tg-search/common'
import { createCoreInstance } from '@tg-search/core'
import { defineWebSocketHandler } from 'h3'

import { sendWsEvent } from './ws-event'

export interface ClientState {
  ctx?: CoreContext

  isConnected: boolean
  phoneNumber?: string
}

type EventListener = <T extends keyof FromCoreEvent>(data: WsEventToClientData<T>) => void

export function setupWsRoutes(app: App) {
  const logger = useLogger('server:ws')
  const clientStatesBySession = new Map<string, ClientState>()
  const eventListenersByPeer = new Map<string, Map<keyof FromCoreEvent, EventListener>>()

  function useSessionId(peer: Peer) {
    const url = new URL(peer.request.url)
    const urlSessionId = url.searchParams.get('sessionId') as UUID
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
      const urlSessionId = url.searchParams.get('sessionId') as UUID

      if (!urlSessionId) {
        // TODO: add error response
        return new Response('Session ID is required', { status: 400 })
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
              logger.withFields({ eventName }).log('Sending event to client')
              sendWsEvent(peer, eventName, data)
            }

            state.ctx?.emitter.on(eventName, (...args) => fn(args[0]))
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
        state.ctx?.emitter.removeListener(eventName, (...args) => fn(args[0]))
      })
    },
  }))
}
