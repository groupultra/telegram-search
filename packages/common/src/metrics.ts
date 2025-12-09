export interface CoreCounter {
  inc: (labels?: Record<string, string>, value?: number) => void
}

export interface CoreHistogram {
  observe: (labels: Record<string, string>, value: number) => void
}

export interface CoreMetrics {
  /**
   * Total number of messages processed by core message resolver.
   * - `source`: 'realtime' | 'takeout'
   */
  messagesProcessed: CoreCounter

  /**
   * Batch duration for message processing in milliseconds.
   * - `source`: 'realtime' | 'takeout'
   */
  messageBatchDuration: CoreHistogram
}
