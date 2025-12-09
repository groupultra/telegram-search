import process from 'node:process'

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

let sdk: NodeSDK | undefined
let initialized = false

/**
 * Initialize OpenTelemetry tracing for the server.
 *
 * Design decisions:
 * - Opt-in by environment:
 *   - Requires either OTEL_EXPORTER_OTLP_TRACES_ENDPOINT or OTEL_EXPORTER_OTLP_ENDPOINT to be set.
 *   - If not set, the SDK is not started to avoid unexpected network calls in dev/test.
 * - Exporter:
 *   - Uses OTLP HTTP trace exporter (compatible with Alloy / generic OTEL collectors).
 *   - Endpoint and headers can be configured via standard OTEL_* environment variables.
 * - Resource:
 *   - Sets service.name so traces are grouped correctly downstream.
 */
export async function initOtel(): Promise<void> {
  if (initialized) {
    return
  }

  if (process.env.OTEL_SDK_DISABLED === 'true') {
    initialized = true
    return
  }

  const tracesEndpoint
    = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT

  // No endpoint configured -> do not start SDK (safe no-op)
  if (!tracesEndpoint) {
    initialized = true
    return
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]:
      process.env.OTEL_SERVICE_NAME ?? 'telegram-search-server',
  })

  const traceExporter = new OTLPTraceExporter({
    // Default url is http://localhost:4318/v1/traces when not provided.
    // We prefer explicit endpoint from env when available.
    url: tracesEndpoint,
  })

  sdk = new NodeSDK({
    resource,
    traceExporter,
  })

  await sdk.start()

  const shutdown = async () => {
    try {
      await sdk?.shutdown()
    }
    catch (error) {
      console.error('Failed to shutdown OpenTelemetry SDK', error)
    }
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)

  initialized = true
}
