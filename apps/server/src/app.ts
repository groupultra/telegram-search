import type { CrossWSOptions } from 'listhen'

import process from 'node:process'

import { flags, parseEnvFlags } from '@tg-search/common'
import { initConfig } from '@tg-search/common/node'
import { initDrizzle } from '@tg-search/core'
import { initLogger, useLogger } from '@unbird/logg'
import { createApp, toNodeListener } from 'h3'
import { listen } from 'listhen'

import { setupWsRoutes } from './ws/routes'

async function initCore(): Promise<ReturnType<typeof useLogger>> {
  parseEnvFlags(process.env as Record<string, string>)
  initLogger()
  const logger = useLogger()
  await initConfig()

  try {
    await initDrizzle(logger)
    logger.log('Database initialized successfully')
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
    debug: flags.isDebugMode,
    onRequest(event) {
      const path = event.path
      const method = event.method

      logger.withFields({
        method,
        path,
      }).log('Request started')
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
  const logger = await initCore()
  setupErrorHandlers(logger)

  const app = configureServer(logger)
  const listener = toNodeListener(app)

  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  // const { handleUpgrade } = wsAdapter(app.websocket as NodeOptions)
  const server = await listen(listener, { port, ws: app.websocket as CrossWSOptions })
  // const server = createServer(listener).listen(port)
  // server.on('upgrade', handleUpgrade)

  logger.log('Server started')

  const shutdown = () => {
    logger.log('Shutting down server gracefully...')
    server.close()
    process.exit(0)
  }
  process.prependListener('SIGINT', shutdown)
  process.prependListener('SIGTERM', shutdown)

  return app
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
