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

  /**
   * Total number of pages fetched from Telegram API during takeout.
   */
  takeoutPageFetchTotal: CoreCounter

  /**
   * Duration of individual page fetch calls in milliseconds.
   */
  takeoutPageFetchDurationMs: CoreHistogram

  /**
   * Total number of takeout sessions initiated.
   * - `status`: 'success' | 'error' | 'timeout'
   */
  takeoutSessionInitTotal: CoreCounter

  /**
   * Duration of per-chat takeout in milliseconds.
   */
  takeoutChatDurationMs: CoreHistogram

  /**
   * Total number of takeout runs started.
   */
  takeoutRunTotal: CoreCounter

  /**
   * Total number of resolver outcomes (success or error).
   * - `resolver`: resolver name
   * - `outcome`: 'success' | 'error'
   */
  resolverOutcome: CoreCounter

  /**
   * Total number of resolvers skipped due to config or syncOptions.
   * - `resolver`: resolver name
   */
  resolverSkipped: CoreCounter

  /**
   * Total number of embedding API calls.
   * - `status`: 'success' | 'error'
   */
  embeddingApiCall: CoreCounter

  /**
   * Total number of embedding tokens consumed.
   */
  embeddingTokens: CoreCounter

  /**
   * Total number of media download outcomes.
   * - `outcome`: 'cache_hit' | 'downloaded' | 'fallback' | 'error'
   */
  mediaDownload: CoreCounter

  /**
   * Total number of vision LLM API calls.
   * - `status`: 'success' | 'error'
   */
  visionApiCall: CoreCounter

  /**
   * Total number of entity resolution outcomes.
   * - `source`: 'cache' | 'db' | 'api'
   * - `outcome`: 'hit' | 'miss'
   */
  entityResolve: CoreCounter

  /**
   * Number of messages per takeout page fetch.
   */
  takeoutPageMessages: CoreHistogram
}
