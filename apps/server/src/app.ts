import type { CoreContext } from '@tg-search/core'
import type { Peer } from 'crossws'
import type { App } from 'h3'
import type { WsMessageToServer } from './v2/ws-event'

import { useLogger } from '@tg-search/common'
import { createCoreInstance } from '@tg-search/core'
import { createRouter, defineEventHandler, defineWebSocketHandler, getQuery } from 'h3'

import { createResponse } from './utils/response'
import { handleConnectionEvent, registerConnectionEventHandler } from './v2/connection'
import { handleDialogsEvent, registerDialogsEventHandler } from './v2/dialogs'
import { handleEntityEvent, registerEntityEventHandler } from './v2/entity'
import { handleMessageEvent, registerMessageEventHandler } from './v2/messages'
import { registerWsMessageRoute, routeWsMessage } from './v2/routes'
import { handleTakeoutEvent, registerTakeoutEventHandler } from './v2/takeout'
import { sendWsError, sendWsEvent } from './v2/ws-event'

// function setupServer(app: App, port: number) {
//   const listener = toNodeListener(app)
//   const server = createServer(listener).listen(port)
//   const { handleUpgrade } = wsAdapter(app.websocket as NodeOptions)
//   server.on('upgrade', handleUpgrade)
// }

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

      // Setup session and login
      // setupSession(ctx)

      // const client = ctx.getClient()
      // ctx.emitter.on('auth:connected', async () => {
      //   if (client && await client.isUserAuthorized()) {
      //     peer.send({ type: 'CONNECTED', data: { isAuthorized: true } })
      //   }
      //   else {
      //     peer.send({ type: 'CONNECTED', data: { isAuthorized: false } })
      //   }
      // })

      // ctx.emitter.on(event: keyof CoreEvent, data: CoreEventData<CoreEvent[typeof event]>) => {
      // ctx.emitter.onAny((event, data) => {
      //   peer.send({ type: event, data })
      // })

      registerConnectionEventHandler(state)
      registerMessageEventHandler(state)
      registerDialogsEventHandler(state)
      registerEntityEventHandler(state)
      registerTakeoutEventHandler(state)

      registerWsMessageRoute('auth', handleConnectionEvent)
      registerWsMessageRoute('message', handleMessageEvent)
      registerWsMessageRoute('dialog', handleDialogsEvent)
      registerWsMessageRoute('entity', handleEntityEvent)
      registerWsMessageRoute('takeout', handleTakeoutEvent)

      // state.ctx?.emitter.on()
      // const events = state.ctx?.emitter.eventNames()
      // events?.forEach((event) => {
      //   state.ctx?.emitter.on(event, (data) => {
      //     sendWsEvent(peer, event, data)
      //   })
      // })

      state.ctx?.emitter.on('core:error', ({ error }: { error?: string | Error | unknown }) => {
        sendWsError(peer, error)
      })

      sendWsEvent(peer, 'server:connected', { sessionId, connected: state.isConnected ?? false })

      clientStates.set(sessionId, state)
    },

    async message(peer, message) {
      const sessionId = useSessionId(peer)
      const state = { ...useSessionState(sessionId), peer }

      const data = message.json<WsMessageToServer>()

      useLogger().withFields({ type: data.type }).debug('[/ws] Message received')

      // const wsMessage = toWsMessage(data)
      // if (!wsMessage) {
      //   sendWsError(peer, 'Unknown message request')
      //   return
      // }

      // useLogger().withFields({ wsMessage }).debug('[/ws] WsMessage converted')
      // console.log(wsMessage)

      try {
        routeWsMessage(state, data)
      }
      catch (error) {
        useLogger().withError(error).error('[/ws] Handle websocket message failed')
      }

      clientStates.set(sessionId, state)
    },

    close(peer) {
      // const sessionId = useSessionId(peer)
      // const state = useSessionState(sessionId)

      // if (state && state.ctx) {
      //   destoryCoreInstance(state.ctx)
      // }

      useLogger().withFields({ peerId: peer.id }).debug('[/ws] Websocket connection closed')
    },
  }))
}

// (async () => {
//   initLogger()
//   const logger = useLogger()
//   initConfig()
//   initDB()

//   const app = createApp()
//   setupServer(app, 3000)

//   setupWsRoutes(app)

//   logger.withFields({ port: 3000 }).debug('Server started')
// })().catch((error) => {
//   console.error(error)
// })
