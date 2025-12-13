import type { Log } from '@guiiai/logg'
import type { Config, OtelConfig, RuntimeFlags } from '@tg-search/common'

import process from 'node:process'

import figlet from 'figlet'

// @ts-expect-error - TODO: setGlobalAfterLog
import { initLogger, setGlobalAfterLog, useLogger } from '@guiiai/logg'
import { parseEnvFlags, parseEnvToConfig } from '@tg-search/common'
import { models } from '@tg-search/core'
import { plugin as wsPlugin } from 'crossws/server'
import { defineEventHandler, H3, serve } from 'h3'
import { collectDefaultMetrics, register } from 'prom-client'

import pkg from '../package.json' with { type: 'json' }

import { v1api } from './apis/v1'
import { emitOtelLog, initOtelLogger, shutdownOtelLogger } from './libs/otel-logger'
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

  collectDefaultMetrics({ prefix: 'telegram_search_' })
  app.get('/metrics', defineEventHandler(async () => {
    const metrics = await register.metrics()
    return new Response(metrics, {
      status: 200,
      headers: { 'Content-Type': register.contentType },
    })
  }))

  logger.withFields({ endpoint: '/metrics' }).log('Metrics endpoint mounted')

  app.mount('/v1', v1api(getDB(), models, getMinioMediaStorage()))

  setupWsRoutes(app, config)

  return app
}

async function bootstrap() {
  figlet.text('Telegram Search', (_, result) => {
    // eslint-disable-next-line no-console
    console.log(`\n${result}\nv${pkg.version}\n`)
  })

  const flags = parseEnvFlags(process.env)
  initLogger(flags.logLevel, flags.logFormat)
  const logger = useLogger().useGlobalConfig()

  const config = parseEnvToConfig(process.env, logger)

  // Initialize OpenTelemetry logger if configured
  if (config.otel?.endpoint) {
    const options: OtelConfig = {
      endpoint: config.otel.endpoint,
      serviceName: config.otel.serviceName || 'telegram-search',
      serviceVersion: config.otel.serviceVersion || pkg.version,
      headers: config.otel.headers,
    }

    initOtelLogger(options)

    setGlobalAfterLog((log: Log) => {
      emitOtelLog(log.level, log.fields.context || 'unknown', log.message, log.fields)
    })

    logger.withFields({
      endpoint: options.endpoint,
      service_name: options.serviceName,
      service_version: options.serviceVersion,
    }).log('OpenTelemetry logger initialized')
  }

  await initDrizzle(logger, config, flags)

  await initMinioMediaStorage(logger, config.minio)

  setupErrorHandlers(logger)

  const app = configureServer(logger, flags, config)

  const port = process.env.PORT ? Number(process.env.PORT) : 3000
  const hostname = process.env.HOST || '0.0.0.0'

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

  const shutdown = async () => {
    logger.log('Shutting down server gracefully...')
    await shutdownOtelLogger()
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
