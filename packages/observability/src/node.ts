import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

/**
 * Register OpenTelemetry SDK with OTLP exporters.
 *
 * All exporters read from the standard `OTEL_EXPORTER_OTLP_ENDPOINT` env var,
 * so a single OTLP Collector endpoint is sufficient for traces, metrics, and logs.
 */
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

  // NOTICE: Metrics are handled by a standalone MeterProvider in metrics.ts,
  // not by NodeSDK, because metrics.ts is imported before registerOtel() runs.
  const sdk = new NodeSDK({
    instrumentations: [
      getNodeAutoInstrumentations(),
      new PgInstrumentation({
        enhancedDatabaseReporting: true,
      }),
    ],
    traceExporter: new OTLPTraceExporter(),
    resource: resourceFromAttributes(attributes),
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter()),
    ],
    logRecordProcessor: new BatchLogRecordProcessor(new OTLPLogExporter(), {
      maxQueueSize: 1000,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 1000,
    }),
  })

  sdk.start()
}
