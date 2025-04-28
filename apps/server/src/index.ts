import type { NodeOptions } from 'crossws/adapters/node'

import process from 'node:process'
import { initLogger, useLogger } from '@tg-search/common'
import { initConfig } from '@tg-search/common/composable'
import { initDrizzle } from '@tg-search/core'
import { createApp, toNodeListener } from 'h3'
import { listen } from 'listhen'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { setupWsRoutes } from './app'

export type * from './app'
export type * from './ws-event'

async function initCore(): Promise<ReturnType<typeof useLogger>> {
  initLogger()
  const logger = useLogger()
  await initConfig()

  try {
    await initDrizzle()
    logger.debug('Database initialized successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize services')
    process.exit(1)
  }

  return logger
}

function setupErrorHandlers(logger: ReturnType<typeof useLogger>): void {
  // TODO: fix type
  const handleError = (error: any, type: string) => {
    logger.withFields({ cause: String(error?.cause), cause_json: JSON.stringify(error?.cause) }).withError(error).error(type)
  }

  process.on('uncaughtException', error => handleError(error, 'Uncaught exception'))
  process.on('unhandledRejection', error => handleError(error, 'Unhandled rejection'))
}

function configureServer(logger: ReturnType<typeof useLogger>) {
  const app = createApp({
    debug: true,
    onRequest(event) {
      const path = event.path
      const method = event.method

      logger.withFields({
        method,
        path,
      }).debug('Request started')
    },
    onError(error, event) {
      const path = event.path
      const method = event.method

      const status = error instanceof Error && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500

      logger.withFields({
        method,
        path,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
      }).error('Request failed')

      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    },
  })

  // app.use(eventHandler((event) => {
  //   setResponseHeaders(event, {
  //     'Access-Control-Allow-Origin': 'http://localhost:3333',
  //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  //     'Access-Control-Allow-Credentials': 'true',
  //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With',
  //   })

  //   if (event.method === 'OPTIONS') {
  //     setResponseHeaders(event, {
  //       'Access-Control-Max-Age': '86400',
  //     })
  //     return null
  //   }
  // }))

  setupWsRoutes(app)

  return app
}

async function bootstrap() {
  const argv = await yargs(hideBin(process.argv))
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'Server listen port',
      default: 3000,
    })
    .help()
    .parse()

  const logger = await initCore()
  setupErrorHandlers(logger)

  const app = configureServer(logger)
  const listener = toNodeListener(app)

  const port = argv.port
  // const { handleUpgrade } = wsAdapter(app.websocket as NodeOptions)
  await listen(listener, { port, ws: app.websocket as NodeOptions })
  // const server = createServer(listener).listen(port)
  // server.on('upgrade', handleUpgrade)

  logger.debug('Server started')

  const shutdown = () => process.exit(0)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return app
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
