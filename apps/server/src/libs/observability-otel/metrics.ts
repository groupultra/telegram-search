import type { CoreCounter, CoreHistogram, CoreMetrics } from '@tg-search/common'

import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

const metricExporter = new OTLPMetricExporter({})

// Create an instance of the metric provider
const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 250,
    }),
  ],
})

const meter = meterProvider.getMeter('@tg-search/server/observability-otel')

/**
 * WebSocket send fail total
 */
export const wsSendFailTotal = meter.createCounter('ws.send.fail.total', {
  description: 'Total number of failed WebSocket sends from server to client',
})

/**
 * WebSocket connections active gauge
 */
export const wsConnectionsActive = meter.createUpDownCounter('ws.connections.active', {
  description: 'Number of active WebSocket connections',
})

/**
 * Core events in total
 */
export const coreEventsInTotal = meter.createCounter('core.events.in.total', {
  description: 'Total number of events sent from client to core',
})

/**
 * Core messages processed total
 */
export const coreMessagesProcessedTotal = meter.createCounter('core.messages.processed.total', {
  description: 'Total number of messages processed by core message resolver',
})

/**
 * Core message batches processed total
 */
export const coreMessageBatchesProcessedTotal = meter.createCounter('core.message.batches.processed.total', {
  description: 'Total number of message batches processed by core message resolver',
})

/**
 * Core message batch duration histogram
 */
export const coreMessageBatchDurationMs = meter.createHistogram('core.message.batch.duration.ms', {
  description: 'Duration of message processing batches in milliseconds',
  unit: 'ms',
})

/**
 * Create OpenTelemetry counter from CoreCounter
 */
function createOtelCounter(otelCounter: ReturnType<typeof meter.createCounter>): CoreCounter {
  return {
    inc(labels?: Record<string, string>, value?: number) {
      otelCounter.add(value ?? 1, labels)
    },
  }
}

/**
 * Create OpenTelemetry histogram from CoreHistogram
 */
function createOtelHistogram(otelHistogram: ReturnType<typeof meter.createHistogram>): CoreHistogram {
  return {
    observe(labels: Record<string, string>, value: number) {
      otelHistogram.record(value, labels)
    },
  }
}

/**
 * Core metrics
 */
export const coreMetrics: CoreMetrics = {
  messagesProcessed: createOtelCounter(coreMessagesProcessedTotal),
  messageBatchDuration: createOtelHistogram(coreMessageBatchDurationMs),
}
