import { env } from 'node:process'

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

export function registerOtel(options?: { debug?: true | DiagLogLevel, version?: string }) {
  const attributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: 'telegram-search',
  }
  if (typeof options?.version !== 'undefined') {
    attributes[ATTR_SERVICE_VERSION] = options.version
  }
  if (typeof options?.debug !== 'undefined') {
    diag.setLogger(
      new DiagConsoleLogger(),
      options.debug === true ? DiagLogLevel.DEBUG : options.debug,
    )
  }

  let metricsExporterInterval = 250
  if (env.OTEL_METRICS_EXPORTER_INTERVAL) {
    const parsed = Number.parseInt(env.OTEL_METRICS_EXPORTER_INTERVAL, 10)
    if (!Number.isNaN(parsed)) {
      metricsExporterInterval = parsed
    }
  }

  const sdk = new NodeSDK({
    instrumentations: [
      getNodeAutoInstrumentations(),
    ],
    metricReaders: [
      new PeriodicExportingMetricReader({
        exportIntervalMillis: metricsExporterInterval,
        exporter: new OTLPMetricExporter(),
      }),
    ],
    resource: resourceFromAttributes(attributes),
    traceExporter: new OTLPTraceExporter(),
    spanProcessors: [
      new SimpleSpanProcessor(new OTLPTraceExporter()),
    ],
    logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter(), {
      maxQueueSize: 1000,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 1000,
    }),
  })

  sdk.start()
}

export { DiagLogLevel } from '@opentelemetry/api'
