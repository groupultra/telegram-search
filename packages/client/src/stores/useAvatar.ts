import { useLogger } from '@guiiai/logg'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export interface AvatarEntry {
  id: string
  blobUrl?: string
  fileId?: string
  mimeType?: string
  updatedAt?: number
  expiresAt?: number
}

type ID = string | number

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Create a centralized avatar store for user and chat avatars.
 * Manages in-memory cache, TTL expiration, and provides helper methods
 * to retrieve and ensure avatar availability via core events.
 */
export const useAvatarStore = defineStore('avatar', () => {
  const websocketStore = useBridgeStore()

  // In-memory caches
  const userAvatars = ref<Map<string, AvatarEntry>>(new Map())
  const chatAvatars = ref<Map<string, AvatarEntry>>(new Map())
  // Track in-flight prioritized chat avatar fetches to avoid duplicate sends
  const inflightChatFetchIds = ref<Set<string>>(new Set())
  // Track in-flight user avatar fetches to avoid duplicate sends
  const inflightUserFetchIds = ref<Set<string>>(new Set())
  // Track in-flight user avatar prefills to avoid duplicate work
  const inflightUserPrefillIds = ref<Set<string>>(new Set())

  // Normalize id to a non-empty string key
  function toKey(id: ID) {
    if (!id)
      return undefined
    const s = String(id)
    return s.length ? s : undefined
  }

  // Unified getter with TTL check and blobUrl revoke on expiration
  function getField(map: typeof userAvatars | typeof chatAvatars, id: ID, field: keyof AvatarEntry) {
    const key = toKey(id)
    if (!key)
      return undefined
    const entry = map.value.get(key)
    if (!entry)
      return undefined
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      if (entry.blobUrl)
        URL.revokeObjectURL(entry.blobUrl)
      map.value.delete(key)
      return undefined
    }
    return entry[field]
  }

  // Unified setter that revokes old blobUrl and applies TTL
  function setEntry(map: typeof userAvatars | typeof chatAvatars, id: string | number, data: { blobUrl: string, fileId?: string, mimeType?: string, ttlMs?: number }) {
    const key = String(id)
    const ttl = data.ttlMs ?? DEFAULT_TTL_MS
    const oldEntry = map.value.get(key)
    if (oldEntry?.blobUrl)
      URL.revokeObjectURL(oldEntry.blobUrl)
    map.value.set(key, {
      id: key,
      blobUrl: data.blobUrl,
      fileId: data.fileId,
      mimeType: data.mimeType,
      updatedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    })
  }

  // Unified validity check: TTL + optional fileId consistency
  function hasValid(map: typeof userAvatars | typeof chatAvatars, id: ID, expectedFileId?: string) {
    const key = toKey(id)
    if (!key)
      return false
    const entry = map.value.get(key)
    if (!entry)
      return false
    const expired = entry.expiresAt && Date.now() > entry.expiresAt
    if (expired)
      return false
    if (expectedFileId && entry.fileId && expectedFileId !== entry.fileId)
      return false
    return Boolean(entry.blobUrl)
  }

  /**
   * Get cached avatar blob URL for a user.
   * Returns undefined if missing or expired.
   */
  function getUserAvatarUrl(userId: ID): string | undefined {
    return getField(userAvatars, userId, 'blobUrl') as string | undefined
  }

  /**
   * Get cached avatar fileId for a user.
   * Returns undefined if missing or expired.
   */
  function getUserAvatarFileId(userId: ID): string | undefined {
    return getField(userAvatars, userId, 'fileId') as string | undefined
  }

  /**
   * Get cached avatar blob URL for a chat.
   * Returns undefined if missing or expired.
   */
  function getChatAvatarUrl(chatId: ID): string | undefined {
    return getField(chatAvatars, chatId, 'blobUrl') as string | undefined
  }

  /**
   * Get cached avatar fileId for a chat.
   * Returns undefined if missing or expired.
   */
  function getChatAvatarFileId(chatId: ID): string | undefined {
    return getField(chatAvatars, chatId, 'fileId') as string | undefined
  }

  /**
   * Set or update a user's avatar cache entry.
   * Accepts blob URL and metadata, and applies TTL by default.
   * Revokes previous blob URL to prevent memory leaks.
   */
  function setUserAvatar(userId: string | number, data: { blobUrl: string, fileId?: string, mimeType?: string, ttlMs?: number }) {
    setEntry(userAvatars, userId, data)
  }

  /**
   * Set or update a chat's avatar cache entry.
   * Accepts blob URL and metadata, and applies TTL by default.
   * Revokes previous blob URL to prevent memory leaks.
   */
  function setChatAvatar(chatId: string | number, data: { blobUrl: string, fileId?: string, mimeType?: string, ttlMs?: number }) {
    setEntry(chatAvatars, chatId, data)
  }

  /**
   * Check whether a chat avatar is present and non-expired in the in-memory cache.
   * Optionally validates that the cached `fileId` matches the given `expectedFileId`.
   */
  function hasValidChatAvatar(chatId: ID, expectedFileId?: string): boolean {
    return hasValid(chatAvatars, chatId, expectedFileId)
  }

  function hasValidUserAvatar(userId: ID, expectedFileId?: string): boolean {
    return hasValid(userAvatars, userId, expectedFileId)
  }

  /**
   * Ensure a user's avatar is available in cache.
   * If missing, triggers a lazy fetch via core event 'entity:avatar:fetch'.
   * Ensure a user's avatar is available in cache.
   * Cache-first: if present and not expired, skip.
   * Dedupe: if a fetch for the same user is already in-flight, skip.
   * Otherwise, mark in-flight and send 'entity:avatar:fetch'.
   * Optional fileId allows core to validate cache before fetching.
   */
  function ensureUserAvatar(userId: ID, fileId?: string, forceRefresh?: boolean) {
    if (!userId)
      return

    const key = String(userId)

    if (!forceRefresh) {
      if (hasValid(userAvatars, key))
        return
      if (inflightUserFetchIds.value.has(key))
        return
    }

    try {
      inflightUserFetchIds.value.add(key)
      websocketStore.sendEvent('entity:avatar:fetch', { userId: key, fileId })
    }
    catch (error) {
      useLogger('avatars').withError(error).warn('ensureUserAvatar sendEvent failed')
    }
  }

  /**
   * Check whether a user avatar fetch is currently in-flight.
   * Helps components avoid re-sending while waiting for data.
   */
  function isUserFetchInflight(userId: ID): boolean {
    if (!userId)
      return false
    return inflightUserFetchIds.value.has(String(userId))
  }

  /**
   * Mark a user avatar fetch as completed.
   * Should be called after 'entity:avatar:data' is handled or on error.
   */
  function markUserFetchCompleted(userId: ID): void {
    if (!userId)
      return
    inflightUserFetchIds.value.delete(String(userId))
  }

  /**
   * Ensure a chat's avatar is available in cache.
   * If missing or expired, triggers prioritized fetch via 'dialog:avatar:fetch'.
   */
  function ensureChatAvatar(chatId: ID, expectedFileId?: string) {
    if (!chatId)
      return
    const key = String(chatId)
    const valid = hasValid(chatAvatars, key, expectedFileId)
    if (valid)
      return
    // Dedupe: if a prioritized fetch is already in-flight for this chat, skip
    if (inflightChatFetchIds.value.has(key))
      return
    try {
      inflightChatFetchIds.value.add(key)
      websocketStore.sendEvent('dialog:avatar:fetch', { chatId: key })
    }
    catch (error) {
      useLogger('avatars').withError(error).warn('ensureChatAvatar sendEvent failed')
    }
  }

  /**
   * Check whether a prioritized chat avatar fetch is currently in-flight.
   * Helps components avoid re-sending the same request while waiting.
   */
  function isChatFetchInflight(chatId: ID): boolean {
    if (!chatId)
      return false
    return inflightChatFetchIds.value.has(String(chatId))
  }

  /**
   * Mark a prioritized chat avatar fetch as completed.
   * Should be called once a 'dialog:avatar:data' arrives or on error.
   */
  function markChatFetchCompleted(chatId: ID): void {
    if (!chatId)
      return
    inflightChatFetchIds.value.delete(String(chatId))
  }

  /**
   * Cleanup expired avatar entries and revoke their blob URLs.
   * Intended to be called periodically or on app lifecycle events.
   */
  function cleanupExpired() {
    const now = Date.now()

    function cleanupMap(map: typeof userAvatars | typeof chatAvatars) {
      for (const [key, entry] of map.value.entries()) {
        if (entry.expiresAt && now > entry.expiresAt) {
          if (entry.blobUrl)
            URL.revokeObjectURL(entry.blobUrl)
          map.value.delete(key)
        }
      }
    }

    cleanupMap(userAvatars)
    cleanupMap(chatAvatars)
  }

  const size = computed(() => ({ users: userAvatars.value.size, chats: chatAvatars.value.size }))

  return {
    userAvatars,
    chatAvatars,
    inflightChatFetchIds,
    inflightUserFetchIds,
    inflightUserPrefillIds,
    size,
    getUserAvatarUrl,
    getUserAvatarFileId,
    getChatAvatarUrl,
    setUserAvatar,
    setChatAvatar,
    hasValidChatAvatar,
    hasValidUserAvatar,
    ensureUserAvatar,
    ensureChatAvatar,
    isUserFetchInflight,
    isChatFetchInflight,
    markUserFetchCompleted,
    markChatFetchCompleted,
    cleanupExpired,
    getChatAvatarFileId,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAvatarStore, import.meta.hot))
}
