import type { Config, RuntimeFlags } from '@tg-search/common'
import type { CrossWSOptions } from 'listhen'

import process from 'node:process'

import { initLogger, useLogger } from '@guiiai/logg'
import { mergeConfigWithEnv, parseEnvFlags } from '@tg-search/common'
import { loadConfigFromFile } from '@tg-search/common/node'
import { initDrizzle } from '@tg-search/core'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { listen } from 'listhen'
import { collectDefaultMetrics, register } from 'prom-client'

import pkg from '../package.json' with { type: 'json' }

import { setupWsRoutes } from './ws/routes'

function setupErrorHandlers(logger: ReturnType<typeof useLogger>): void {
  const handleError = (error: unknown, type: string) => {
    logger.withError(error).error(type)
  }

  process.on('uncaughtException', error => handleError(error, 'Uncaught exception'))
  process.on('unhandledRejection', error => handleError(error, 'Unhandled rejection'))
}

function configureServer(logger: ReturnType<typeof useLogger>, flags: RuntimeFlags, config: Config) {
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

  const router = createRouter()
  router.get('/health', defineEventHandler(() => {
    return Response.json({ success: true })
  }))

  collectDefaultMetrics()
  router.get('/metrics', defineEventHandler(async () => {
    const metrics = await register.metrics()
    return new Response(metrics, {
      status: 200,
      headers: { 'Content-Type': register.contentType },
    })
  }))

  app.use(router)
  setupWsRoutes(app, config)

  return app
}

async function bootstrap() {
  const flags = parseEnvFlags(process.env)
  initLogger(flags.logLevel, flags.logFormat)
  const logger = useLogger().useGlobalConfig()

  logger.log(`Telegram Search v${pkg.version}`)

  const config = mergeConfigWithEnv(process.env, await loadConfigFromFile())

  try {
    await initDrizzle(logger, config, {
      isDatabaseDebugMode: flags.isDatabaseDebugMode,
      disableMigrations: flags.disableMigrations,
    })
    logger.log('Database initialized successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize services')
    process.exit(1)
  }

  setupErrorHandlers(logger)

  const app = configureServer(logger, flags, config)
  const listener = toNodeListener(app)

  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  const server = await listen(listener, { port, ws: app.websocket as CrossWSOptions })

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
