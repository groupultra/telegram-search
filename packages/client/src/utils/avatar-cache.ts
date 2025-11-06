/**
 * IndexedDB-based persistent cache for avatar resources.
 * Stores compressed Blob, metadata and TTL for user/chat avatars.
 * Provides cache-first load, ETag-like validation (SHA-256 digest),
 * periodic cleanup and monitoring stats.
 */

// DB config
const AVATAR_DB_NAME = 'tg-avatar-cache'
const AVATAR_STORE = 'records'
const DB_VERSION = 2

// Policy config
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_CACHE_BYTES_DEFAULT = 50 * 1024 * 1024 // 50 MB

export interface AvatarCacheRecord {
  /**
   * Deterministic primary key for a single avatar scope.
   * Example: `user:12345` or `chat:67890`.
   */
  scopeId: string
  userId?: string
  chatId?: string
  blob: Blob
  mimeType: string
  size: number
  etag: string
  lastModified: number
  createdAt: number
  expiresAt: number
}

interface AvatarCacheStats {
  hits: number
  misses: number
  writes: number
  evictions: number
  failures: number
  count: number
  totalSizeBytes: number
  lastCleanupAt?: number
  debug: boolean
}

// Module-level singleton state
let dbPromise: Promise<IDBDatabase | null> | null = null
const stats: AvatarCacheStats = {
  hits: 0,
  misses: 0,
  writes: 0,
  evictions: 0,
  failures: 0,
  count: 0,
  totalSizeBytes: 0,
  debug: false,
}

/**
 * Open or create the avatar cache database and object store.
 * Returns null if IndexedDB is unavailable.
 * v2: Switch to deterministic keyPath `scopeId` to allow O(1) lookups.
 */
async function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise)
    return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(AVATAR_DB_NAME, DB_VERSION)
      req.onupgradeneeded = (_ev) => {
        const db = req.result
        try {
          if (db.objectStoreNames.contains(AVATAR_STORE))
            db.deleteObjectStore(AVATAR_STORE)
        }
        catch (e) {
          console.warn('[AvatarCache] failed deleting old store', e)
        }
        const store = db.createObjectStore(AVATAR_STORE, { keyPath: 'scopeId' })
        store.createIndex('userId', 'userId', { unique: false })
        store.createIndex('chatId', 'chatId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('expiresAt', 'expiresAt', { unique: false })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }
    catch (err) {
      // Fallback when IndexedDB throws in restricted environments
      console.warn('[AvatarCache] openDb error', err)
      resolve(null)
    }
  })
  return dbPromise
}

/**
 * Compute SHA-256 digest (hex) for a Blob or byte array.
 * Used as an ETag-like validator for avatar bytes.
 */
async function sha256Hex(input: Blob | Uint8Array): Promise<string> {
  const data: ArrayBuffer = input instanceof Blob
    ? await input.arrayBuffer()
    : (input.buffer as ArrayBuffer)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build deterministic scope keys for user/chat avatars.
 */
function scopeKeyForUser(id: string): string {
  return `user:${id}`
}

function scopeKeyForChat(id: string): string {
  return `chat:${id}`
}

/**
 * Internal helper to put a record into the store.
 * Upsert a record into the store using the `scopeId` key.
 */
async function putRecord(db: IDBDatabase, record: AvatarCacheRecord): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AVATAR_STORE, 'readwrite')
    const store = tx.objectStore(AVATAR_STORE)
    const req = store.put(record)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Internal helper to clear all records from the store.
 */
async function clearStore(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AVATAR_STORE, 'readwrite')
    const store = tx.objectStore(AVATAR_STORE)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Internal helper to iterate all records and run a visitor.
 */
async function visitAll(db: IDBDatabase, visitor: (rec: AvatarCacheRecord) => void | boolean | Promise<void | boolean>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AVATAR_STORE, 'readonly')
    const store = tx.objectStore(AVATAR_STORE)
    const req = store.openCursor()
    req.onsuccess = async () => {
      const cursor = req.result as IDBCursorWithValue | null
      if (!cursor)
        return resolve()
      const record = cursor.value as AvatarCacheRecord
      const shouldStop = await visitor(record)
      if (shouldStop)
        return resolve()
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * Persist a user avatar Blob into IndexedDB with TTL and metadata.
 * If IndexedDB is unavailable, the operation is silently skipped.
 * Upserts by deterministic `scopeId` to avoid multiple records per user.
 */
export async function persistUserAvatar(userId: string, blob: Blob, mimeType: string): Promise<void> {
  const db = await openDb()
  if (!db)
    return
  try {
    const scopeId = scopeKeyForUser(userId)
    const etag = await sha256Hex(blob)
    const now = Date.now()
    const record: AvatarCacheRecord = {
      scopeId,
      userId,
      blob,
      mimeType,
      size: blob.size,
      etag,
      lastModified: now,
      createdAt: now,
      expiresAt: now + DEFAULT_TTL_MS,
    }
    await putRecord(db, record)
    stats.writes += 1
    // Update rough counters; exact size/count are refreshed via getAvatarCacheStats
  }
  catch (err) {
    stats.failures += 1
    if (stats.debug)
      console.warn('[AvatarCache] persistUserAvatar failed', err)
  }
}

/**
 * Persist a chat avatar Blob into IndexedDB with TTL and metadata.
 * Upserts by deterministic `scopeId` to avoid multiple records per chat.
 */
export async function persistChatAvatar(chatId: string | number, blob: Blob, mimeType: string): Promise<void> {
  const db = await openDb()
  if (!db)
    return
  try {
    const id = String(chatId)
    const scopeId = scopeKeyForChat(id)
    const etag = await sha256Hex(blob)
    const now = Date.now()
    const record: AvatarCacheRecord = {
      scopeId,
      chatId: id,
      blob,
      mimeType,
      size: blob.size,
      etag,
      lastModified: now,
      createdAt: now,
      expiresAt: now + DEFAULT_TTL_MS,
    }
    await putRecord(db, record)
    stats.writes += 1
  }
  catch (err) {
    stats.failures += 1
    if (stats.debug)
      console.warn('[AvatarCache] persistChatAvatar failed', err)
  }
}

/**
 * Load latest valid user avatar from cache and return an object URL and mimeType.
 * Returns undefined if not found or expired.
 */
/**
 * Load latest valid user avatar by primary key and return an object URL + mimeType.
 */
export async function loadUserAvatarFromCache(userId: string | number | undefined): Promise<{ url: string, mimeType: string } | undefined> {
  if (!userId)
    return undefined
  const db = await openDb()
  if (!db)
    return undefined
  const id = String(userId)
  let latest: AvatarCacheRecord | undefined
  try {
    latest = await new Promise<AvatarCacheRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(AVATAR_STORE, 'readonly')
      const store = tx.objectStore(AVATAR_STORE)
      const req = store.get(scopeKeyForUser(id))
      req.onsuccess = () => resolve(req.result as AvatarCacheRecord | undefined)
      req.onerror = () => reject(req.error)
    })
  }
  catch (err) {
    stats.failures += 1
    if (stats.debug)
      console.warn('[AvatarCache] loadUserAvatarFromCache failed', err)
    return undefined
  }

  if (!latest) {
    stats.misses += 1
    return undefined
  }
  if (latest.expiresAt && Date.now() > latest.expiresAt) {
    stats.misses += 1
    return undefined
  }
  try {
    const url = URL.createObjectURL(latest.blob)
    stats.hits += 1
    return { url, mimeType: latest.mimeType }
  }
  catch (err) {
    stats.failures += 1
    if (stats.debug)
      console.warn('[AvatarCache] objectURL failed', err)
    return undefined
  }
}

/**
 * Load latest valid chat avatar from cache and return an object URL and mimeType.
 */
/**
 * Load latest valid chat avatar by primary key and return an object URL + mimeType.
 */
export async function loadChatAvatarFromCache(chatId: string | number | undefined): Promise<{ url: string, mimeType: string } | undefined> {
  if (!chatId)
    return undefined
  const db = await openDb()
  if (!db)
    return undefined
  const id = String(chatId)
  let latest: AvatarCacheRecord | undefined
  try {
    latest = await new Promise<AvatarCacheRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(AVATAR_STORE, 'readonly')
      const store = tx.objectStore(AVATAR_STORE)
      const req = store.get(scopeKeyForChat(id))
      req.onsuccess = () => resolve(req.result as AvatarCacheRecord | undefined)
      req.onerror = () => reject(req.error)
    })
  }
  catch (err) {
    stats.failures += 1
    if (stats.debug)
      console.warn('[AvatarCache] loadChatAvatarFromCache failed', err)
    return undefined
  }

  if (!latest) {
    stats.misses += 1
    return undefined
  }
  if (latest.expiresAt && Date.now() > latest.expiresAt) {
    stats.misses += 1
    return undefined
  }
  try {
    const url = URL.createObjectURL(latest.blob)
    stats.hits += 1
    return { url, mimeType: latest.mimeType }
  }
  catch (err) {
    stats.failures += 1
    if (stats.debug)
      console.warn('[AvatarCache] objectURL failed', err)
    return undefined
  }
}

/**
 * Evict expired records and trim by size budget.
 * Returns number of records removed.
 * Implementation uses IndexedDB cursor iteration to avoid loading all Blobs into memory.
 */
/**
 * Evict expired records and trim by size budget using cursors.
 * Works with deterministic key `scopeId` for efficient deletions.
 */
export async function evictExpiredOrOversized(maxBytes: number = MAX_CACHE_BYTES_DEFAULT): Promise<number> {
  const db = await openDb()
  if (!db)
    return 0

  let removed = 0
  let totalSize = 0
  const now = Date.now()

  // Track minimal metadata to decide trimming without holding Blob objects
  const survivors: Array<{ scopeId: string, size: number, createdAt: number }> = []
  const expiredKeys: string[] = []

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AVATAR_STORE, 'readonly')
      const store = tx.objectStore(AVATAR_STORE)
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null
        if (!cursor)
          return resolve()
        const rec = cursor.value as AvatarCacheRecord
        if (rec.expiresAt && now > rec.expiresAt) {
          expiredKeys.push(rec.scopeId)
        }
        else {
          const size = rec.size ?? rec.blob?.size ?? 0
          totalSize += size
          survivors.push({ scopeId: rec.scopeId, size, createdAt: rec.createdAt })
        }
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  }
  catch (err) {
    stats.failures += 1
    if (stats.debug)
      console.warn('[AvatarCache] evictExpiredOrOversized scan failed', err)
    return 0
  }

  // Delete expired records
  if (expiredKeys.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AVATAR_STORE, 'readwrite')
      const store = tx.objectStore(AVATAR_STORE)
      for (const key of expiredKeys) store.delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    removed += expiredKeys.length
  }

  // Trim by size budget (oldest first)
  if (totalSize > maxBytes && survivors.length > 0) {
    const sorted = survivors.sort((a, b) => a.createdAt - b.createdAt)
    const toDelete: string[] = []
    for (const r of sorted) {
      if (totalSize <= maxBytes)
        break
      toDelete.push(r.scopeId)
      totalSize -= r.size
    }
    if (toDelete.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(AVATAR_STORE, 'readwrite')
        const store = tx.objectStore(AVATAR_STORE)
        for (const key of toDelete) store.delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      removed += toDelete.length
    }
  }

  stats.evictions += removed
  stats.lastCleanupAt = Date.now()
  return removed
}

/**
 * Clear the entire avatar cache.
 */
export async function clearAvatarCache(): Promise<void> {
  const db = await openDb()
  if (!db)
    return
  try {
    await clearStore(db)
  }
  catch (err) {
    stats.failures += 1
    if (stats.debug)
      console.warn('[AvatarCache] clearAvatarCache failed', err)
  }
}

/**
 * Compute current stats by scanning all records.
 */
export async function getAvatarCacheStats(): Promise<AvatarCacheStats> {
  const db = await openDb()
  if (!db)
    return { ...stats }
  let count = 0
  let totalSizeBytes = 0
  await visitAll(db, (rec) => {
    count += 1
    totalSizeBytes += rec.size || 0
  })
  return { ...stats, count, totalSizeBytes }
}

/**
 * Enable or disable debug logging.
 */
export function setAvatarCacheDebug(enabled: boolean): void {
  stats.debug = enabled
}

/**
 * Convenience: prefill in-memory avatar store for user from disk cache.
 * Returns true if a cached avatar was loaded into memory.
 */
export async function prefillUserAvatarIntoStore(userId: string | number | undefined): Promise<boolean> {
  try {
    const mod = await loadUserAvatarFromCache(userId)
    if (!mod)
      return false
    const { useAvatarStore } = await import('../stores/useAvatar')
    useAvatarStore().setUserAvatar(String(userId!), { blobUrl: mod.url, mimeType: mod.mimeType, ttlMs: DEFAULT_TTL_MS })
    return true
  }
  catch {
    return false
  }
}

/**
 * Convenience: prefill in-memory avatar store for chat from disk cache.
 */
export async function prefillChatAvatarIntoStore(chatId: string | number | undefined): Promise<boolean> {
  try {
    const mod = await loadChatAvatarFromCache(chatId)
    if (!mod)
      return false
    const { useAvatarStore } = await import('../stores/useAvatar')
    useAvatarStore().setChatAvatar(String(chatId!), { blobUrl: mod.url, mimeType: mod.mimeType, ttlMs: DEFAULT_TTL_MS })
    return true
  }
  catch {
    return false
  }
}

export const AVATAR_CACHE_DEFAULT_TTL = DEFAULT_TTL_MS
export const AVATAR_CACHE_MAX_BYTES = MAX_CACHE_BYTES_DEFAULT
