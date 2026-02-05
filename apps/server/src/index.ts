import type { Log, Logger } from '@guiiai/logg'
import type { Config, RuntimeFlags } from '@tg-search/common'

import process from 'node:process'

import figlet from 'figlet'

import { initLogger, LoggerFormat, setGlobalHookPostLog, useLogger } from '@guiiai/logg'
import { createBotRegistry, setBotRegistryInstance } from '@tg-search/bot'
import { parseEnvFlags, parseEnvToConfig } from '@tg-search/common'
import { models } from '@tg-search/core'
import { emitOtelLog } from '@tg-search/observability'
import { registerOtel } from '@tg-search/observability/node'
import { plugin as wsPlugin } from 'crossws/server'
import { defineEventHandler, H3, serve } from 'h3'

import pkg from '../package.json' with { type: 'json' }

import { v1api } from './apis/v1'
import { setupWsRoutes } from './app'
import { getDB, initDrizzle } from './storage/drizzle'
import { getMediaStorage, initMediaStorage } from './storage/media'
import { removeHyperLinks, toSnakeCaseFields } from './utils/fields'

function setupErrorHandlers(logger: Logger): void {
  const handleError = (error: unknown, type: string) => {
    logger.withError(error).error(type)
  }

  process.on('uncaughtException', error => handleError(error, 'Uncaught exception'))
  process.on('unhandledRejection', error => handleError(error, 'Unhandled rejection'))
}

function configureServer(logger: Logger, flags: RuntimeFlags, config: Config) {
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
    },
  })

  app.get('/health', defineEventHandler(() => {
    return Response.json({ success: true })
  }))

  app.mount('/v1', v1api(getDB(), models, getMediaStorage()))

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

  if (process.env.OTEL_ENABLED === 'true') {
    logger.log('OTEL is enabled')

    const otelDebug = process.env.OTEL_DEBUG === 'true' || undefined
    registerOtel({ version: pkg.version, debug: otelDebug })

    setGlobalHookPostLog((log: Log, formattedOutput: string) => {
      const fieldsSnake = toSnakeCaseFields(log.fields)

      if (flags.logFormat === LoggerFormat.Pretty) {
        const rawContext = removeHyperLinks(log.context)
        const rawFields = formattedOutput?.split(log.message)[1]?.trim()
        const message = `[${rawContext}] ${log.message} ${rawFields}`

        emitOtelLog(log.level, rawContext, message, fieldsSnake)
      }
      else {
        emitOtelLog(log.level, log.context, formattedOutput, fieldsSnake)
      }
    })
  }

  await initDrizzle(logger, config, flags)

  await initMediaStorage(logger, config)

  setupErrorHandlers(logger)

  // Initialize Grammy bot (non-blocking, no-op if TELEGRAM_BOT_TOKEN not set)
  const botRegistry = createBotRegistry({
    config,
    getDB,
    logger,
  })
  setBotRegistryInstance(botRegistry)
  await botRegistry.start()

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
    await botRegistry.stop()
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
