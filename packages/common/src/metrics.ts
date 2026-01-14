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

  /**
   * Duration of individual resolvers in milliseconds.
   * - `resolver`: 'embedding' | 'jieba' | 'media' | 'link' | 'user' | 'avatar'
   */
  resolverDuration: CoreHistogram

  /**
   * Total number of messages downloaded from Telegram via takeout.
   */
  takeoutDownloadTotal: CoreCounter
}
