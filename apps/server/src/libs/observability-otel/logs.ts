import type { Log } from '@guiiai/logg'

import process from 'node:process'

import { setGlobalHookPostLog, useLogger } from '@guiiai/logg'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

import pkg from '../../../package.json' with { type: 'json' }

import { removeHyperLinks, toSnakeCaseFields } from '../../utils/fields'
import { asyncLocalStorage } from './traces'

let loggerProvider: LoggerProvider | null = null
let isInitialized = false
const logger = useLogger('otel-logger')

/**
 * Initialize OpenTelemetry logger with Loki backend.
 * This should be called once during application startup.
 */
export function initOtelLogger(): void {
  if (!process.env.OTEL_EXPORTER_LOGS_ENDPOINT) {
    return
  }

  // Prevent double initialization
  if (isInitialized) {
    logger.warn('OpenTelemetry logger is already initialized')
    return
  }

  try {
    // Create OTLP exporter for Loki
    const logExporter = new OTLPLogExporter()

    // Create batch processor for efficient log shipping
    const processor = new BatchLogRecordProcessor(logExporter, {
      // Batch config - adjust based on your needs
      maxQueueSize: 1000,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 1000, // Ship logs every 1 second
    })

    // Create resource with service information
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'telegram-search',
      [ATTR_SERVICE_VERSION]: pkg.version,
    })

    // Create logger provider with resource and processor
    loggerProvider = new LoggerProvider({
      resource,
      processors: [processor],
    })

    // Set as global logger provider
    logs.setGlobalLoggerProvider(loggerProvider)

    isInitialized = true

    logger.log('OpenTelemetry logger initialized')
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize OpenTelemetry logger')
  }
}

/**
 * Shutdown the OpenTelemetry logger gracefully.
 * This should be called during application shutdown.
 */
export async function shutdownOtelLogger(): Promise<void> {
  if (!loggerProvider) {
    return
  }

  try {
    await loggerProvider.shutdown()
    isInitialized = false
    loggerProvider = null
    logger.log('OpenTelemetry logger shut down successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to shutdown OpenTelemetry logger')
  }
}

/**
 * Helper to emit a log to OpenTelemetry
 * This can be called manually from your code when you want to send logs to OTEL
 */
export function emitOtelLog(level: string, context: string, message: string, attributes?: Record<string, string | number | boolean>): void {
  if (!isInitialized) {
    return
  }

  const otelLogger = logs.getLogger(context)

  // Map log level to OpenTelemetry severity
  const getSeverity = (level: string): SeverityNumber => {
    switch (level.toLowerCase()) {
      case 'debug':
        return SeverityNumber.DEBUG
      case 'verbose':
        return SeverityNumber.TRACE
      case 'log':
      case 'info':
        return SeverityNumber.INFO
      case 'warn':
        return SeverityNumber.WARN
      case 'error':
        return SeverityNumber.ERROR
      default:
        return SeverityNumber.INFO
    }
  }

  const store = asyncLocalStorage.getStore()
  const tracingId = store?.tracingId
  const body = tracingId ? `${message} [tracing_id: ${tracingId}]` : message

  otelLogger.emit({
    severityNumber: getSeverity(level),
    severityText: level.toUpperCase(),
    body,
    attributes: {
      ...attributes,
      tracing_id: store?.tracingId,
    },
  })
}

export function initOtel() {
  initOtelLogger()

  setGlobalHookPostLog((log: Log, formattedOutput: string) => {
    const rawContext = removeHyperLinks(log.context)
    const rawFields = formattedOutput?.split(log.message)[1]?.trim()
    const fieldsSnake = toSnakeCaseFields(log.fields)
    const message = `[${rawContext}] ${log.message} ${rawFields}`

    emitOtelLog(log.level, rawContext, message, fieldsSnake)
  })
}
