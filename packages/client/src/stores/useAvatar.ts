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

  /**
   * Get cached avatar blob URL for a user.
   * Returns undefined if missing or expired.
   */
  function getUserAvatarUrl(userId: string | number | undefined): string | undefined {
    if (!userId)
      return undefined
    const key = String(userId)
    const entry = userAvatars.value.get(key)
    if (!entry)
      return undefined
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      // Expired, cleanup and return undefined
      if (entry.blobUrl)
        URL.revokeObjectURL(entry.blobUrl)
      userAvatars.value.delete(key)
      return undefined
    }
    return entry.blobUrl
  }

  /**
   * Get cached avatar blob URL for a chat.
   * Returns undefined if missing or expired.
   */
  function getChatAvatarUrl(chatId: string | number | undefined): string | undefined {
    if (!chatId)
      return undefined
    const key = String(chatId)
    const entry = chatAvatars.value.get(key)
    if (!entry)
      return undefined
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      if (entry.blobUrl)
        URL.revokeObjectURL(entry.blobUrl)
      chatAvatars.value.delete(key)
      return undefined
    }
    return entry.blobUrl
  }

  /**
   * Set or update a user's avatar cache entry.
   * Accepts blob URL and metadata, and applies TTL by default.
   */
  function setUserAvatar(userId: string | number, data: { blobUrl: string, fileId?: string, mimeType?: string, ttlMs?: number }) {
    const key = String(userId)
    const ttl = data.ttlMs ?? DEFAULT_TTL_MS
    userAvatars.value.set(key, {
      id: key,
      blobUrl: data.blobUrl,
      fileId: data.fileId,
      mimeType: data.mimeType,
      updatedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    })
  }

  /**
   * Set or update a chat's avatar cache entry.
   * Accepts blob URL and metadata, and applies TTL by default.
   */
  function setChatAvatar(chatId: string | number, data: { blobUrl: string, fileId?: string, mimeType?: string, ttlMs?: number }) {
    const key = String(chatId)
    const ttl = data.ttlMs ?? DEFAULT_TTL_MS
    chatAvatars.value.set(key, {
      id: key,
      blobUrl: data.blobUrl,
      fileId: data.fileId,
      mimeType: data.mimeType,
      updatedAt: Date.now(),
      expiresAt: Date.now() + ttl,
    })
  }

  /**
   * Check whether a chat avatar is present and non-expired in the in-memory cache.
   * Optionally validates that the cached `fileId` matches the given `expectedFileId`.
   *
   * @param chatId - Chat identifier
   * @param expectedFileId - Optional fileId to validate against the cached entry
   * @returns true if a valid avatar exists (and fileId matches when provided)
   */
  function hasValidChatAvatar(chatId: string | number | undefined, expectedFileId?: string): boolean {
    if (!chatId)
      return false
    const key = String(chatId)
    const entry = chatAvatars.value.get(key)
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
   * Ensure a user's avatar is available in cache.
   * If missing, triggers a lazy fetch via core event 'entity:avatar:fetch'.
   */
  function ensureUserAvatar(userId: string | number | undefined) {
    if (!userId)
      return
    const key = String(userId)
    const existing = userAvatars.value.get(key)
    if (existing && (!existing.expiresAt || Date.now() < existing.expiresAt))
      return
    try {
      websocketStore.sendEvent('entity:avatar:fetch', { userId: key })
    }
    catch (error) {
      console.warn('[Avatar] ensureUserAvatar sendEvent failed:', error)
    }
  }

  /**
   * Ensure a chat's avatar is available in cache.
   * If missing or expired, triggers prioritized fetch via 'dialog:avatar:fetch'.
   */
  function ensureChatAvatar(chatId: string | number | undefined, expectedFileId?: string) {
    if (!chatId)
      return
    const key = String(chatId)
    const valid = hasValidChatAvatar(key, expectedFileId)
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
      console.warn('[Avatar] ensureChatAvatar sendEvent failed:', error)
    }
  }

  /**
   * Check whether a prioritized chat avatar fetch is currently in-flight.
   * Helps components avoid re-sending the same request while waiting.
   */
  function isChatFetchInflight(chatId: string | number | undefined): boolean {
    if (!chatId)
      return false
    return inflightChatFetchIds.value.has(String(chatId))
  }

  /**
   * Mark a prioritized chat avatar fetch as completed.
   * Should be called once a 'dialog:avatar:data' arrives or on error.
   */
  function markChatFetchCompleted(chatId: string | number | undefined): void {
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

    for (const [key, entry] of userAvatars.value.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        if (entry.blobUrl)
          URL.revokeObjectURL(entry.blobUrl)
        userAvatars.value.delete(key)
      }
    }

    for (const [key, entry] of chatAvatars.value.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        if (entry.blobUrl)
          URL.revokeObjectURL(entry.blobUrl)
        chatAvatars.value.delete(key)
      }
    }
  }

  const size = computed(() => ({ users: userAvatars.value.size, chats: chatAvatars.value.size }))

  return {
    userAvatars,
    chatAvatars,
    inflightChatFetchIds,
    size,
    getUserAvatarUrl,
    getChatAvatarUrl,
    setUserAvatar,
    setChatAvatar,
    hasValidChatAvatar,
    ensureUserAvatar,
    ensureChatAvatar,
    isChatFetchInflight,
    markChatFetchCompleted,
    cleanupExpired,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAvatarStore, import.meta.hot))
}
