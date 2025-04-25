import type { CoreContext, CoreEventData, FromCoreEvent, ToCoreEvent } from '@tg-search/core'
import type { Peer } from 'crossws'
import type { App } from 'h3'
import type { WsMessageToServer } from './utils/ws-event'

import { useLogger } from '@tg-search/common'
import { createCoreInstance } from '@tg-search/core'
import { createRouter, defineEventHandler, defineWebSocketHandler, getQuery } from 'h3'

import { createResponse } from './utils/response'
import { sendWsEvent } from './utils/ws-event'

export interface ClientState {
  ctx?: CoreContext
  peer: Peer

  isConnected?: boolean
  phoneNumber?: string

  registedEvents?: Set<keyof FromCoreEvent>
}

type UUID = ReturnType<typeof crypto.randomUUID>

export function setupWsRoutes(app: App) {
  const logger = useLogger('server:ws')
  const clientStates = new Map<string, Omit<ClientState, 'peer'>>()

  function useSessionId(peer: Peer) {
    const url = new URL(peer.request.url)
    const urlSessionId = url.searchParams.get('sessionId') as UUID
    return urlSessionId || crypto.randomUUID()
  }

  function useSessionState(sessionId: UUID) {
    if (!clientStates.has(sessionId)) {
      const ctx = createCoreInstance()
      clientStates.set(sessionId, {
        ctx,
        isConnected: false,
        registedEvents: new Set(),
      })
      logger.withFields({ sessionId }).debug('Session restored')

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

      logger.withFields({ peer: peer.id }).debug('Websocket connection opened')

      // state.ctx?.wrapEmitterEmit(state.ctx?.emitter, (event) => {
      //   state.ctx?.emitter.on(event, (...args) => {
      //     try {
      //       // ensure args[0] can be stringified
      //       JSON.stringify(args[0])

      //       sendWsEvent(peer, event, args[0])
      //     }
      //     catch {
      //       logger.withFields({ event }).warn('Dropped event')
      //     }
      //   })
      // })

      sendWsEvent(peer, 'server:connected', { sessionId, connected: state.isConnected ?? false })

      clientStates.set(sessionId, state)
    },

    async message(peer, message) {
      const sessionId = useSessionId(peer)
      const state = { ...useSessionState(sessionId), peer }

      const event = message.json<WsMessageToServer>()

      logger.withFields({ type: event.type }).debug('Message received')

      try {
        if (event.type === 'server:registerEvent') {
          if (!event.data.event.startsWith('server:')) {
            const eventName = event.data.event as keyof FromCoreEvent

            if (!state.registedEvents?.has(eventName)) {
              state.registedEvents?.add(eventName)

              logger.withFields({ eventName }).debug('Register event')

              state.ctx?.emitter.on(eventName, (...args) => {
                try {
                  // ensure args[0] can be stringified
                  JSON.stringify(args[0])

                  sendWsEvent(peer, eventName, args[0])
                }
                catch {
                  logger.withFields({ eventName }).warn('Dropped event data')

                  sendWsEvent(peer, eventName, undefined)
                }
              })
            }
          }
        }
        else {
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

      clientStates.set(sessionId, state)
    },

    close(peer) {
      logger.withFields({ peerId: peer.id }).debug('Websocket connection closed')
    },
  }))
}
