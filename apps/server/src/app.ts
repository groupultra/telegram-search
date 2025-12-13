import type { Config, RuntimeFlags } from '@tg-search/common'

import process from 'node:process'

import figlet from 'figlet'

import { initLogger, useLogger } from '@guiiai/logg'
import { parseEnvFlags, parseEnvToConfig } from '@tg-search/common'
import { models } from '@tg-search/core'
import { plugin as wsPlugin } from 'crossws/server'
import { defineEventHandler, H3, serve } from 'h3'
import { collectDefaultMetrics, register } from 'prom-client'

import pkg from '../package.json' with { type: 'json' }

import { v1api } from './apis/v1'
import { getDB, initDrizzle } from './storage/drizzle'
import { getMinioMediaStorage, initMinioMediaStorage } from './storage/minio'
import { setupWsRoutes } from './ws-routes'

function setupErrorHandlers(logger: ReturnType<typeof useLogger>): void {
  const handleError = (error: unknown, type: string) => {
    logger.withError(error).error(type)
  }

  process.on('uncaughtException', error => handleError(error, 'Uncaught exception'))
  process.on('unhandledRejection', error => handleError(error, 'Unhandled rejection'))
}

function configureServer(logger: ReturnType<typeof useLogger>, flags: RuntimeFlags, config: Config) {
  const app = new H3({
    debug: flags.isDebugMode,
    onRequest(event) {
      const path = event.url.pathname
      const method = event.req.method

      logger.withFields({
        method,
        path,
      }).debug('Request started')
    },
    onError(error, event) {
      const path = event.url.pathname
      const method = event.req.method

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

  app.get('/health', defineEventHandler(() => {
    return Response.json({ success: true })
  }))

  collectDefaultMetrics()
  app.get('/metrics', defineEventHandler(async () => {
    const metrics = await register.metrics()
    return new Response(metrics, {
      status: 200,
      headers: { 'Content-Type': register.contentType },
    })
  }))

  app.mount('/v1', v1api(getDB(), models, getMinioMediaStorage()))

  setupWsRoutes(app, config)

  return app
}

async function bootstrap() {
  figlet.text('Telegram Search', (_, result) => {
    // eslint-disable-next-line no-console
    console.log(`\n${result}\nv${pkg.version}\n`)
  })

  Object.assign(import.meta.env, process.env)
  const flags = parseEnvFlags(import.meta.env)
  initLogger(flags.logLevel, flags.logFormat)
  const logger = useLogger().useGlobalConfig()

  const config = parseEnvToConfig(import.meta.env, logger)

  await initDrizzle(logger, config, flags)

  await initMinioMediaStorage(logger)

  setupErrorHandlers(logger)

  const app = configureServer(logger, flags, config)

  const port = import.meta.env.PORT ? Number(import.meta.env.PORT) : 3000
  const hostname = import.meta.env.HOST || '0.0.0.0'

  const server = serve(app, {
    port,
    hostname,
    plugins: [
      // @ts-expect-error - the .crossws property wasn't extended in types
      wsPlugin({ resolve: async req => (await app.fetch(req)).crossws }),
    ],
    reusePort: true,
    gracefulShutdown: {
      forceTimeout: 500,
      gracefulTimeout: 500,
    },
  })

  logger.withFields({ port, hostname }).log('Server started')

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
