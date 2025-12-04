// Message processing batch size
// For messages containing a large amount of media, a smaller batch should be used to avoid high memory usage
export const MESSAGE_PROCESS_BATCH_SIZE = 50
export const MESSAGE_RESOLVER_QUEUE_SIZE = 4

// LRU cache configuration
export const MAX_AVATAR_CACHE_SIZE = 150
export const AVATAR_CACHE_TTL = 15 * 60 * 1000
export const AVATAR_DOWNLOAD_CONCURRENCY = 4

// Limit concurrent download count to avoid memory explosion from downloading too many files simultaneously
export const MEDIA_DOWNLOAD_CONCURRENCY = 32

// Telegram history request throttling (ms) to avoid triggering FloodWait
export const TELEGRAM_HISTORY_INTERVAL_MS = 1000
