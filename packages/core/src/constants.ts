// Message processing batch size
// For messages containing a large amount of media, a smaller batch should be used to avoid high memory usage
export const MESSAGE_PROCESS_BATCH_SIZE = 20
export const MESSAGE_PROCESS_LIMIT = 2

// Media processing batch size - for messages with media
// Media files (images, stickers, etc.) consume more memory, so use smaller batches
export const MEDIA_PROCESS_BATCH_SIZE = 5

// LRU cache configuration
export const MAX_AVATAR_CACHE_SIZE = 200 // Maximum cache of 200 avatars
export const AVATAR_CACHE_TTL = 30 * 60 * 1000 // Expire after 30 minutes (milliseconds)
export const AVATAR_DOWNLOAD_CONCURRENCY = 10 // Avatar download concurrency limit

// Limit concurrent download count to avoid memory explosion from downloading too many files simultaneously
export const MEDIA_DOWNLOAD_CONCURRENCY = 10
