import type { CoreContext, CoreEventData, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'
import type { App } from 'h3'
import type { WsMessageToServer } from './utils/ws-event'

import { useLogger } from '@tg-search/common'
import { createCoreInstance } from '@tg-search/core'
import { createRouter, defineEventHandler, defineWebSocketHandler, getQuery } from 'h3'

import { createResponse } from './utils/response'
import { sendWsError, sendWsEvent } from './utils/ws-event'

export interface ClientState {
  ctx?: CoreContext
  peer: Peer

  isConnected?: boolean
  phoneNumber?: string
}

type UUID = ReturnType<typeof crypto.randomUUID>

export function setupWsRoutes(app: App) {
  const clientStates = new Map<string, Omit<ClientState, 'peer'>>()

  function useSessionId(peer: Peer) {
    const url = new URL(peer.request.url)
    const urlSessionId = url.searchParams.get('sessionId') as UUID
    return urlSessionId || crypto.randomUUID()
  }

  function useSessionState(sessionId: UUID) {
    if (!clientStates.has(sessionId)) {
      const ctx = createCoreInstance()
      clientStates.set(sessionId, { ctx, isConnected: false })
      useLogger().withFields({ sessionId }).debug('[/ws] Session restored')

      return { ctx }
    }

    return clientStates.get(sessionId)
  }

  const router = createRouter()

  router.post('/session', defineEventHandler(async (req) => {
    const query = getQuery(req)
    const sessionId = query.sessionId as UUID ?? crypto.randomUUID()
    return createResponse({ sessionId })
  }))

  app.use('/v2', router.handler)

  app.use('/ws', defineWebSocketHandler({
    async upgrade(req) {
      const url = new URL(req.url)
      const urlSessionId = url.searchParams.get('sessionId') as UUID

      if (!urlSessionId) {
        // FIXME: fix response type
        return new Response('Session ID is required', { status: 400 })
      }
    },

    async open(peer) {
      const sessionId = useSessionId(peer)
      const state = { ...useSessionState(sessionId), peer }

      useLogger().withFields({ peer: peer.id }).debug('[/ws] Websocket connection opened')

      state.ctx?.wrapEmitterFromCore(state.ctx?.emitter, (event) => {
        state.ctx?.emitter.on(event, (...args) => {
          sendWsEvent(peer, event, args[0])
        })
      })

      state.ctx?.fromCoreEvents.forEach((event) => {
        state.ctx?.emitter.on(event, (...args) => {
          sendWsEvent(peer, event, args[0])
        })
      })

      state.ctx?.emitter.on('core:error', ({ error }: { error?: string | Error | unknown }) => {
        sendWsError(peer, error)
      })

      sendWsEvent(peer, 'server:connected', { sessionId, connected: state.isConnected ?? false })

      clientStates.set(sessionId, state)
    },

    async message(peer, message) {
      const sessionId = useSessionId(peer)
      const state = { ...useSessionState(sessionId), peer }

      const event = message.json<WsMessageToServer>()

      useLogger().withFields({ type: event.type }).debug('[/ws] Message received')

      try {
        state.ctx?.emitter.emit(event.type, event.data as CoreEventData<keyof ToCoreEvent>)

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
        useLogger().withError(error).error('[/ws] Handle websocket message failed')
      }

      clientStates.set(sessionId, state)
    },

    close(peer) {
      useLogger().withFields({ peerId: peer.id }).debug('[/ws] Websocket connection closed')
    },
  }))
}
