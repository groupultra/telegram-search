import type { CoreCounter, CoreHistogram, CoreMetrics } from '@tg-search/common'

import { Counter, Gauge, Histogram } from 'prom-client'

export const wsConnectionsActive = new Gauge({
  name: 'ws_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['mode'] as const,
})

export const coreEventsInTotal = new Counter({
  name: 'core_events_in_total',
  help: 'Total number of events sent from client to core',
  labelNames: ['event_name'] as const,
})

export const coreMessagesProcessedTotal = new Counter({
  name: 'core_messages_processed_total',
  help: 'Total number of messages processed by core message resolver',
  labelNames: ['source'] as const, // realtime | takeout
})

export const coreMessageBatchesProcessedTotal = new Counter({
  name: 'core_message_batches_processed_total',
  help: 'Total number of message batches processed by core message resolver',
  labelNames: ['source'] as const, // realtime | takeout
})

export const coreMessageBatchDurationMs = new Histogram({
  name: 'core_message_batch_duration_ms',
  help: 'Duration of message processing batches in milliseconds',
  labelNames: ['source'] as const, // realtime | takeout
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
})

function createPromCounter(counter: Counter): CoreCounter {
  return {
    inc(labels?: Record<string, string>, value?: number) {
      if (labels) {
        counter.inc(labels as any, value)
      }
      else {
        counter.inc(value)
      }
    },
  }
}

function createPromHistogram(histogram: Histogram): CoreHistogram {
  return {
    observe(labels: Record<string, string>, value: number) {
      histogram.observe(labels as any, value)
    },
  }
}

export const coreMetrics: CoreMetrics = {
  messagesProcessed: createPromCounter(coreMessagesProcessedTotal),
  messageBatchDuration: createPromHistogram(coreMessageBatchDurationMs),
}
