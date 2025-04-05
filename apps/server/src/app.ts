import type { CoreContext } from '@tg-search/core'
import type { Peer } from 'crossws'
import type { App } from 'h3'
import type { WsMessageToServer } from './v2/ws-event'

import { useLogger } from '@tg-search/common'
import { createCoreInstance, destoryCoreInstance } from '@tg-search/core'
import { defineWebSocketHandler } from 'h3'

import { handleConnectionEvent, registerConnectionEventHandler } from './v2/connection'
import { handleDialogsEvent, registerDialogsEventHandler } from './v2/dialogs'
import { handleMessageEvent, registerMessageEventHandler } from './v2/messages'
import { registerWsMessageRoute, routeWsMessage } from './v2/routes'
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
}

type UUID = ReturnType<typeof crypto.randomUUID>

export function setupWsRoutes(app: App) {
  const clientStates = new Map<string, Omit<ClientState, 'peer'>>()

  function useSessionId(peer: Peer) {
    const url = new URL(peer.request.url)
    const urlSessionId = url.searchParams.get('session') as UUID
    return urlSessionId || crypto.randomUUID()
  }

  function useSessionState(sessionId: UUID) {
    if (!clientStates.has(sessionId)) {
      const ctx = createCoreInstance()
      clientStates.set(sessionId, { ctx })
      useLogger().debug('[/ws] Session restored', { sessionId })

      return { ctx }
    }

    return clientStates.get(sessionId)
  }

  app.use('/ws', defineWebSocketHandler({
    async open(peer) {
      const sessionId = useSessionId(peer)
      const state = { ...useSessionState(sessionId), peer }

      useLogger().debug('[/ws] Websocket connection opened', { peer: peer.id })

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

      state.ctx?.emitter.on('core:error', ({ error }: { error?: string | Error | unknown }) => {
        sendWsError(peer, error)
      })

      sendWsEvent(peer, 'server:connected', { sessionId })
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
        registerWsMessageRoute('auth', handleConnectionEvent)
        registerWsMessageRoute('message', handleMessageEvent)
        registerWsMessageRoute('dialog', handleDialogsEvent)

        routeWsMessage(state, data)
      }
      catch (error) {
        useLogger().error('[/ws] Handle websocket message failed', { error })
      }
    },

    close(peer) {
      const sessionId = useSessionId(peer)
      const state = useSessionState(sessionId)

      if (state && state.ctx) {
        destoryCoreInstance(state.ctx)
      }

      useLogger().debug('[/ws] Websocket connection closed', { peerId: peer.id })
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
