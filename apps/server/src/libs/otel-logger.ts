import type { Log } from '@guiiai/logg'
import type { Config } from '@tg-search/common'

import { setGlobalHookPostLog, useLogger } from '@guiiai/logg'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

import pkg from '../../package.json' with { type: 'json' }

import { removeHyperLinks, toSnakeCaseFields } from '../utils/fields'

let loggerProvider: LoggerProvider | null = null
let isInitialized = false

export interface OtelConfig {
  /**
   * OTLP endpoint URL for sending logs to Loki
   * Example: http://localhost:3100/otlp/v1/logs
   */
  endpoint?: string

  /**
   * Service name for log identification
   */
  serviceName?: string

  /**
   * Service version
   */
  serviceVersion?: string

  /**
   * Additional headers for OTLP exporter (e.g., authentication)
   */
  headers?: Record<string, string>
}

/**
 * Initialize OpenTelemetry logger with Loki backend.
 * This should be called once during application startup.
 */
export function initOtelLogger(config: OtelConfig): void {
  // Skip initialization if no endpoint is provided
  if (!config.endpoint) {
    return
  }

  // Prevent double initialization
  if (isInitialized) {
    console.warn('OpenTelemetry logger is already initialized')
    return
  }

  try {
    // Create OTLP exporter for Loki
    const logExporter = new OTLPLogExporter({
      url: config.endpoint,
      headers: config.headers || {},
    })

    // Create batch processor for efficient log shipping
    const processor = new BatchLogRecordProcessor(logExporter, {
      // Batch config - adjust based on your needs
      maxQueueSize: 1000,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 1000, // Ship logs every 1 second
    })

    // Create resource with service information
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName || 'telegram-search',
      [ATTR_SERVICE_VERSION]: config.serviceVersion || pkg.version,
    })

    // Create logger provider with resource and processor
    loggerProvider = new LoggerProvider({
      resource,
      processors: [processor],
    })

    // Set as global logger provider
    logs.setGlobalLoggerProvider(loggerProvider)

    isInitialized = true

    console.info(`OpenTelemetry logger initialized with endpoint: ${config.endpoint}`)
  }
  catch (error) {
    console.error('Failed to initialize OpenTelemetry logger:', error)
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
    console.info('OpenTelemetry logger shut down successfully')
  }
  catch (error) {
    console.error('Failed to shutdown OpenTelemetry logger:', error)
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

  otelLogger.emit({
    severityNumber: getSeverity(level),
    severityText: level.toUpperCase(),
    body: message,
    attributes: attributes || {},
  })
}

export function initOtel(config: Config) {
  // Initialize OpenTelemetry logger if configured
  if (config.otel?.endpoint) {
    const options: OtelConfig = {
      endpoint: config.otel.endpoint,
      serviceName: config.otel.serviceName || 'telegram-search',
      serviceVersion: config.otel.serviceVersion || pkg.version,
      headers: config.otel.headers,
    }

    initOtelLogger(options)

    setGlobalHookPostLog((log: Log, formattedOutput: string) => {
      const rawContext = removeHyperLinks(log.context)
      const rawFields = formattedOutput?.split(log.message)[1]?.trim()
      const fieldsSnake = toSnakeCaseFields(log.fields)
      const message = `[${rawContext}] ${log.message} ${rawFields}`

      emitOtelLog(log.level, rawContext, message, fieldsSnake)
    })

    useLogger().withFields({
      endpoint: options.endpoint,
      service_name: options.serviceName,
      service_version: options.serviceVersion,
    }).log('OpenTelemetry logger initialized')
  }
}
