import type { CoreContext } from '@tg-search/core/src/core/context'
import type { NodeOptions } from 'crossws/adapters/node'
import type { App } from 'h3'

import { createServer } from 'node:http'
import { initConfig, initDB, initLogger, useLogger } from '@tg-search/common'
import { createCoreClient, destoryCoreClient, setupSession } from '@tg-search/core'
import wsAdapter from 'crossws/adapters/node'
import { createApp, defineWebSocketHandler, toNodeListener } from 'h3'

function setupServer(app: App, port: number) {
  const listener = toNodeListener(app)
  const server = createServer(listener).listen(port)
  const { handleUpgrade } = wsAdapter(app.websocket as NodeOptions)
  server.on('upgrade', handleUpgrade)
}

interface ClientState {
  ctx?: CoreContext
}

function setupWsRoutes(app: App) {
  const clientStates = new Map<string, ClientState>()
  const logger = useLogger()

  app.use('/ws', defineWebSocketHandler({
    async open(peer) {
      logger.debug('[/ws] Websocket connection opened', { peerId: peer.id })

      const ctx = createCoreClient()
      clientStates.set(peer.id, { ctx })

      // Setup session and login
      setupSession(ctx)

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
      ctx.emitter.onAny((event, data) => {
        peer.send({ type: event, data })
      })

      peer.send({ type: 'auth:connected', data: { clientId: peer.id } })
    },

    async message(peer, message) {
      let clientState = clientStates.get(peer.id)
      if (!clientState) {
        clientState = { ctx: createCoreClient() }
        clientStates.set(peer.id, clientState)
      }

      try {
        const msgData = JSON.parse(message)

        // TODO: route message

        switch (msgData.type) {
          default:
            logger.warn('[/ws] Unknown message type', { type: msgData.type })
        }
      }
      catch (error) {
        logger.error('[/ws] Handle websocket message failed', { error })
      }
    },

    close(peer) {
      logger.debug('[/ws] Websocket connection closed', { peerId: peer.id })

      const clientState = clientStates.get(peer.id)
      if (clientState && clientState.ctx) {
        destoryCoreClient(clientState.ctx)
      }

      clientStates.delete(peer.id)
    },
  }))
}

(async () => {
  initLogger()
  const logger = useLogger()
  initConfig()
  initDB()

  const app = createApp()
  setupServer(app, 3000)

  setupWsRoutes(app)

  logger.withFields({ port: 3000 }).debug('Server started')
})().catch((error) => {
  console.error(error)
})
