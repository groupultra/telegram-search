import type { CoreCounter, CoreHistogram, CoreMetrics } from '@tg-search/common'

import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'

const metricExporter = new OTLPMetricExporter({})

// NOTICE: Uses a standalone MeterProvider instead of the global one from NodeSDK.
// The global MeterProvider (registered by registerOtel/NodeSDK.start()) is not available
// at module load time because metrics.ts is imported before registerOtel() is called.
// Instruments created from a NoopMeter do not rebind when the real provider registers later.
const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 250,
    }),
  ],
})

const meter = meterProvider.getMeter('@tg-search/observability')

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
 * Core resolver duration histogram
 */
export const coreResolverDurationMs = meter.createHistogram('core.resolver.duration.ms', {
  description: 'Duration of individual message resolvers in milliseconds',
  unit: 'ms',
})

/**
 * Core takeout messages downloaded total
 */
export const coreTakeoutDownloadedTotal = meter.createCounter('core.takeout.downloaded.total', {
  description: 'Total number of messages downloaded from Telegram via takeout',
})

/**
 * Core takeout page fetch total
 */
export const coreTakeoutPageFetchTotal = meter.createCounter('core.takeout.page.fetch.total', {
  description: 'Total number of pages fetched from Telegram API during takeout',
})

/**
 * Core takeout page fetch duration histogram
 */
export const coreTakeoutPageFetchDurationMs = meter.createHistogram('core.takeout.page.fetch.duration.ms', {
  description: 'Duration of individual page fetch calls in milliseconds',
  unit: 'ms',
})

/**
 * Core takeout session init total
 */
export const coreTakeoutSessionInitTotal = meter.createCounter('core.takeout.session.init.total', {
  description: 'Total number of takeout sessions initiated',
})

/**
 * Core takeout chat duration histogram
 */
export const coreTakeoutChatDurationMs = meter.createHistogram('core.takeout.chat.duration.ms', {
  description: 'Duration of per-chat takeout in milliseconds',
  unit: 'ms',
})

/**
 * Core takeout run total
 */
export const coreTakeoutRunTotal = meter.createCounter('core.takeout.run.total', {
  description: 'Total number of takeout runs started',
})

/**
 * Core resolver outcome total
 */
export const coreResolverOutcomeTotal = meter.createCounter('core.resolver.outcome.total', {
  description: 'Total number of resolver outcomes (success or error)',
})

/**
 * Core resolver skipped total
 */
export const coreResolverSkippedTotal = meter.createCounter('core.resolver.skipped.total', {
  description: 'Total number of resolvers skipped due to config or syncOptions',
})

/**
 * Core embedding API call total
 */
export const coreEmbeddingApiCallTotal = meter.createCounter('core.embedding.api.call.total', {
  description: 'Total number of embedding API calls',
})

/**
 * Core embedding tokens total
 */
export const coreEmbeddingTokensTotal = meter.createCounter('core.embedding.tokens.total', {
  description: 'Total number of embedding tokens consumed',
})

/**
 * Core media download total
 */
export const coreMediaDownloadTotal = meter.createCounter('core.media.download.total', {
  description: 'Total number of media download outcomes',
})

/**
 * Core vision API call total
 */
export const coreVisionApiCallTotal = meter.createCounter('core.vision.api.call.total', {
  description: 'Total number of vision LLM API calls',
})

/**
 * Core entity resolve total
 */
export const coreEntityResolveTotal = meter.createCounter('core.entity.resolve.total', {
  description: 'Total number of entity resolution outcomes',
})

/**
 * Core takeout page messages histogram
 */
export const coreTakeoutPageMessages = meter.createHistogram('core.takeout.page.messages', {
  description: 'Number of messages per takeout page fetch',
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
  resolverDuration: createOtelHistogram(coreResolverDurationMs),
  takeoutDownloadTotal: createOtelCounter(coreTakeoutDownloadedTotal),
  takeoutPageFetchTotal: createOtelCounter(coreTakeoutPageFetchTotal),
  takeoutPageFetchDurationMs: createOtelHistogram(coreTakeoutPageFetchDurationMs),
  takeoutSessionInitTotal: createOtelCounter(coreTakeoutSessionInitTotal),
  takeoutChatDurationMs: createOtelHistogram(coreTakeoutChatDurationMs),
  takeoutRunTotal: createOtelCounter(coreTakeoutRunTotal),
  resolverOutcome: createOtelCounter(coreResolverOutcomeTotal),
  resolverSkipped: createOtelCounter(coreResolverSkippedTotal),
  embeddingApiCall: createOtelCounter(coreEmbeddingApiCallTotal),
  embeddingTokens: createOtelCounter(coreEmbeddingTokensTotal),
  mediaDownload: createOtelCounter(coreMediaDownloadTotal),
  visionApiCall: createOtelCounter(coreVisionApiCallTotal),
  entityResolve: createOtelCounter(coreEntityResolveTotal),
  takeoutPageMessages: createOtelHistogram(coreTakeoutPageMessages),
}
