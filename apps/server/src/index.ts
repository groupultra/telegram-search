import type { NodeOptions } from 'crossws/adapters/node'
import type { App } from 'h3'

import { createServer } from 'node:http'
import process from 'node:process'
import { initConfig, initDB, initLogger, useLogger } from '@tg-search/common'
import wsAdapter from 'crossws/adapters/node'
import {
  createApp,
  eventHandler,
  setResponseHeaders,
  toNodeListener,
} from 'h3'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { setupChatRoutes } from './routes/chat'
import { setupCommandRoutes } from './routes/commands'
import { setupConfigRoutes } from './routes/config'
import { setupMessageRoutes } from './routes/message'
import { setupSearchRoutes } from './routes/search'
import { setupUserInfoRoutes } from './routes/user-info'
import { setupWsAuthRoutes } from './routes/ws-auth'
import { createErrorResponse } from './utils/response'

export * from './types'

// Core initialization
async function initCore(): Promise<ReturnType<typeof useLogger>> {
  initLogger()
  const logger = useLogger()
  initConfig()

  try {
    await initDB()
    logger.debug('Database initialized successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize services')
    process.exit(1)
  }

  return logger
}

// Error handling setup
function setupErrorHandlers(logger: ReturnType<typeof useLogger>): void {
  const handleFatalError = (error: unknown, type: string) => {
    logger.withError(error).error(type)
    process.exit(1)
  }

  process.on('uncaughtException', error => handleFatalError(error, 'Uncaught exception'))
  process.on('unhandledRejection', error => handleFatalError(error, 'Unhandled rejection'))
}

/**
 * Setup all routes for the application
 */
function setupRoutes(app: App) {
  setupChatRoutes(app)
  setupCommandRoutes(app)
  setupConfigRoutes(app)
  setupMessageRoutes(app)
  setupSearchRoutes(app)
  setupWsAuthRoutes(app)
  setupUserInfoRoutes(app)
}

// Server configuration
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

      return createErrorResponse(error)
    },
  })

  // CORS middleware
  app.use(eventHandler((event) => {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': 'http://localhost:3333',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With',
    })

    if (event.method === 'OPTIONS') {
      setResponseHeaders(event, {
        'Access-Control-Max-Age': '86400',
      })
      return null
    }
  }))

  // Setup routes
  setupRoutes(app)

  return app
}

// Main application bootstrap
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
  const server = createServer(listener).listen(port)
  const { handleUpgrade } = wsAdapter(app.websocket as NodeOptions)
  server.on('upgrade', handleUpgrade)
  logger.withFields({ port }).debug('Server started')

  const shutdown = () => process.exit(0)
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return app
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
