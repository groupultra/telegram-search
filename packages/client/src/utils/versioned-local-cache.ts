export interface VersionedCacheEntry<T> {
  data: T
  updatedAt: number
  version: number
}

export type VersionedScopedStorage<T> = Record<string, VersionedCacheEntry<T>>

interface VersionedCacheOptions {
  maxScopes?: number
  now?: number
  ttlMs: number
  version: number
}

function isFiniteTimestamp(value: number) {
  return Number.isFinite(value) && value > 0
}

export function sanitizeVersionedScopedStorage<T>(
  storage: VersionedScopedStorage<T>,
  options: VersionedCacheOptions,
): VersionedScopedStorage<T> {
  const now = options.now ?? Date.now()
  const maxScopes = options.maxScopes ?? Number.POSITIVE_INFINITY

  const entries = Object.entries(storage)
    .filter(([, entry]) => {
      return entry.version === options.version
        && isFiniteTimestamp(entry.updatedAt)
        && now - entry.updatedAt <= options.ttlMs
    })
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, maxScopes)

  return Object.fromEntries(entries)
}

export function readVersionedScopedCache<T>(
  storage: VersionedScopedStorage<T>,
  scope: string | undefined,
  fallback: T,
  options: VersionedCacheOptions,
) {
  if (!scope) {
    return fallback
  }

  const sanitizedStorage = sanitizeVersionedScopedStorage(storage, options)
  return sanitizedStorage[scope]?.data ?? fallback
}

export function writeVersionedScopedCache<T>(
  storage: VersionedScopedStorage<T>,
  scope: string | undefined,
  data: T,
  options: VersionedCacheOptions,
) {
  if (!scope) {
    return storage
  }

  const sanitizedStorage = sanitizeVersionedScopedStorage(storage, options)
  return {
    ...sanitizedStorage,
    [scope]: {
      data,
      updatedAt: options.now ?? Date.now(),
      version: options.version,
    },
  }
}
