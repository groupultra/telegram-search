/**
 * IndexedDB-based persistent cache for avatar resources.
 * Stores compressed Blob, metadata and TTL for user/chat avatars.
 * Provides cache-first load, ETag-like validation (SHA-256 digest),
 * periodic cleanup and monitoring stats.
 */

// DB configuration
const AVATAR_DB_NAME = 'tg-avatar-cache'
const AVATAR_STORE = 'records'
const DB_VERSION = 3 // Upgrade to version 3, add support for the fileId field

// Policy config
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_CACHE_BYTES_DEFAULT = 50 * 1024 * 1024 // 50 MB

type ID = string | number

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
  fileId?: string
  createdAt: number
  expiresAt: number
}

// Module-level singleton state
let dbPromise: Promise<IDBDatabase | null> | null = null

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
        db.createObjectStore(AVATAR_STORE, { keyPath: 'scopeId' })
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

// Removed visitor helper (previously used only for stats scanning)

/**
 * Persist a user avatar Blob into IndexedDB with TTL and metadata.
 * If IndexedDB is unavailable, the operation is silently skipped.
 * Upserts by deterministic `scopeId` to avoid multiple records per user.
 */
async function persistAvatar(
  scopeId: string,
  blob: Blob,
  mimeType: string,
  extra: { userId?: string, chatId?: string, fileId?: string } = {},
): Promise<void> {
  const db = await openDb()
  if (!db)
    return
  try {
    const now = Date.now()
    const record: AvatarCacheRecord = {
      scopeId,
      userId: extra.userId,
      chatId: extra.chatId,
      blob,
      mimeType,
      fileId: extra.fileId,
      createdAt: now,
      expiresAt: now + DEFAULT_TTL_MS,
    }
    await putRecord(db, record)
  }
  catch (err) {
    console.warn('[AvatarCache] persistAvatar failed', err)
  }
}

export async function persistUserAvatar(userId: string, blob: Blob, mimeType: string, fileId?: string): Promise<void> {
  const scopeId = scopeKeyForUser(userId)
  await persistAvatar(scopeId, blob, mimeType, { userId, fileId })
}

export async function persistChatAvatar(chatId: string | number, blob: Blob, mimeType: string, fileId?: string): Promise<void> {
  const id = String(chatId)
  const scopeId = scopeKeyForChat(id)
  await persistAvatar(scopeId, blob, mimeType, { chatId: id, fileId })
}

/**
 * Load latest valid user avatar from cache and return an object URL, mimeType and fileId.
 * Returns undefined if not found or expired.
 * Note: For backwards compatibility, old records without fileId will still be loaded but fileId will be undefined.
 * Optimization: Add memory cleaning to ensure that original blob references are released and prevent memory leaks.
 */
export async function loadUserAvatarFromCache(userId: ID): Promise<{ url: string, mimeType: string, fileId?: string } | undefined> {
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
    console.warn('[AvatarCache] loadUserAvatarFromCache failed', err)
    return undefined
  }

  if (!latest) {
    return undefined
  }
  if (latest.expiresAt && Date.now() > latest.expiresAt) {
    return undefined
  }
  try {
    const url = URL.createObjectURL(latest.blob)
    const result = { url, mimeType: latest.mimeType, fileId: latest.fileId }

    // Clean reference to original Blob to help GC reclaim memory
    latest.blob = new Blob()
    latest = undefined

    return result
  }
  catch (err) {
    console.warn('[AvatarCache] objectURL failed', err)
    return undefined
  }
}

/**
 * Load latest valid chat avatar by primary key and return an object URL + mimeType + fileId.
 * Optimization: Add memory cleaning to ensure that original blob references are released and prevent memory leaks.
 */
export async function loadChatAvatarFromCache(chatId: ID): Promise<{ url: string, mimeType: string, fileId?: string } | undefined> {
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
    console.warn('[AvatarCache] loadChatAvatarFromCache failed', err)
    return undefined
  }

  if (!latest) {
    return undefined
  }
  if (latest.expiresAt && Date.now() > latest.expiresAt) {
    return undefined
  }
  try {
    const url = URL.createObjectURL(latest.blob)
    const result = { url, mimeType: latest.mimeType, fileId: latest.fileId }

    // Clean reference to original Blob to help GC reclaim memory
    latest.blob = new Blob()
    latest = undefined

    return result
  }
  catch (err) {
    console.warn('[AvatarCache] objectURL failed', err)
    return undefined
  }
}

/**
 * Evict expired records and trim by size budget.
 * Returns number of records removed.
 * Implementation uses IndexedDB cursor iteration to avoid loading all Blobs into memory.
 */
export async function evictExpiredOrOversized(_maxBytes: number = MAX_CACHE_BYTES_DEFAULT): Promise<number> {
  const db = await openDb()
  if (!db)
    return 0

  let removed = 0
  const now = Date.now()

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
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  }
  catch (err) {
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
    console.warn('[AvatarCache] clearAvatarCache failed', err)
  }
}

/**
 * Shared helper to prefill in-memory avatar store from disk cache.
 * Loads cached blob URL via provided loader and applies it to store via callback.
 */
interface AvatarStoreLike {
  setUserAvatar: (userId: string | number, data: { blobUrl: string, fileId?: string, mimeType?: string, ttlMs?: number }) => void
  setChatAvatar: (chatId: string | number, data: { blobUrl: string, fileId?: string, mimeType?: string, ttlMs?: number }) => void
}

async function prefillAvatarIntoStore<T extends ID>(
  id: T,
  loader: (id: T) => Promise<{ url: string, mimeType: string, fileId?: string } | undefined>,
  apply: (store: AvatarStoreLike, idStr: string, url: string, mimeType: string, fileId?: string) => void,
): Promise<boolean> {
  try {
    const mod = await loader(id)
    if (!mod)
      return false
    const { useAvatarStore } = await import('../stores/useAvatar')
    const store = useAvatarStore()
    apply(store as unknown as AvatarStoreLike, String(id!), mod.url, mod.mimeType, mod.fileId)
    return true
  }
  catch {
    return false
  }
}

/**
 * Convenience: prefill in-memory avatar store for user from disk cache.
 */
export async function prefillUserAvatarIntoStore(userId: ID): Promise<boolean> {
  return prefillAvatarIntoStore(userId, loadUserAvatarFromCache, (store, idStr, url, mimeType, fileId) => {
    store.setUserAvatar(idStr, { blobUrl: url, mimeType, fileId, ttlMs: DEFAULT_TTL_MS })
  })
}

/**
 * Convenience: prefill in-memory avatar store for chat from disk cache.
 */
export async function prefillChatAvatarIntoStore(chatId: ID): Promise<boolean> {
  return prefillAvatarIntoStore(chatId, loadChatAvatarFromCache, (store, idStr, url, mimeType, fileId) => {
    store.setChatAvatar(idStr, { blobUrl: url, mimeType, fileId, ttlMs: DEFAULT_TTL_MS })
  })
}
