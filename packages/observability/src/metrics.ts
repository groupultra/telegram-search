import type { Counter, Histogram, UpDownCounter } from '@opentelemetry/api'
import type { CoreCounter, CoreHistogram, CoreMetrics } from '@tg-search/common'

import { metrics } from '@opentelemetry/api'

// Lazy meter accessor — defers getMeter() until first use so the global
// MeterProvider registered by registerOtel() in node.ts is available.
let _meter: ReturnType<typeof metrics.getMeter> | undefined
function meter() {
  _meter ??= metrics.getMeter('@tg-search/observability')
  return _meter
}

/**
 * Lazy metric instrument factory. Returns a proxy that creates the real
 * instrument on first property access, ensuring registerOtel() has run.
 */
function lazyCounter(name: string, options: { description: string }): Counter {
  let inst: Counter | undefined
  return new Proxy({} as Counter, {
    get(_, prop) {
      inst ??= meter().createCounter(name, options)
      return Reflect.get(inst, prop)
    },
  })
}

function lazyUpDownCounter(name: string, options: { description: string }): UpDownCounter {
  let inst: UpDownCounter | undefined
  return new Proxy({} as UpDownCounter, {
    get(_, prop) {
      inst ??= meter().createUpDownCounter(name, options)
      return Reflect.get(inst, prop)
    },
  })
}

function lazyHistogram(name: string, options: { description: string, unit?: string }): Histogram {
  let inst: Histogram | undefined
  return new Proxy({} as Histogram, {
    get(_, prop) {
      inst ??= meter().createHistogram(name, options)
      return Reflect.get(inst, prop)
    },
  })
}

/**
 * WebSocket send fail total
 */
export const wsSendFailTotal = lazyCounter('ws.send.fail.total', {
  description: 'Total number of failed WebSocket sends from server to client',
})

/**
 * WebSocket connections active gauge
 */
export const wsConnectionsActive = lazyUpDownCounter('ws.connections.active', {
  description: 'Number of active WebSocket connections',
})

/**
 * Core events in total
 */
export const coreEventsInTotal = lazyCounter('core.events.in.total', {
  description: 'Total number of events sent from client to core',
})

/**
 * Core messages processed total
 */
export const coreMessagesProcessedTotal = lazyCounter('core.messages.processed.total', {
  description: 'Total number of messages processed by core message resolver',
})

/**
 * Core message batches processed total
 */
export const coreMessageBatchesProcessedTotal = lazyCounter('core.message.batches.processed.total', {
  description: 'Total number of message batches processed by core message resolver',
})

/**
 * Core message batch duration histogram
 */
export const coreMessageBatchDurationMs = lazyHistogram('core.message.batch.duration.ms', {
  description: 'Duration of message processing batches in milliseconds',
  unit: 'ms',
})

/**
 * Core resolver duration histogram
 */
export const coreResolverDurationMs = lazyHistogram('core.resolver.duration.ms', {
  description: 'Duration of individual message resolvers in milliseconds',
  unit: 'ms',
})

/**
 * Core takeout messages downloaded total
 */
export const coreTakeoutDownloadedTotal = lazyCounter('core.takeout.downloaded.total', {
  description: 'Total number of messages downloaded from Telegram via takeout',
})

/**
 * Create OpenTelemetry counter from CoreCounter
 */
function createOtelCounter(otelCounter: Counter): CoreCounter {
  return {
    inc(labels?: Record<string, string>, value?: number) {
      otelCounter.add(value ?? 1, labels)
    },
  }
}

/**
 * Create OpenTelemetry histogram from CoreHistogram
 */
function createOtelHistogram(otelHistogram: Histogram): CoreHistogram {
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
}
