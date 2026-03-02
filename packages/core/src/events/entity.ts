import type { Api } from 'telegram'

import { defineEventa } from '@moeru/eventa'

// ============================================================================
// Entity commands (fire-and-forget, mostly internal)
// ============================================================================

/** Process and cache user/chat entities from Telegram API */
export const entityProcessEvent = defineEventa<{ users: Api.TypeUser[], chats: Api.TypeChat[] }>('entity:process')

/** Lazy fetch of a user's avatar */
export const entityAvatarFetchEvent = defineEventa<{ userId: string, fileId?: string }>('entity:avatar:fetch')

/** Prime the core LRU cache with user avatar fileId from frontend IndexedDB */
export const entityAvatarPrimeCacheEvent = defineEventa<{ userId: string, fileId: string }>('entity:avatar:prime-cache')

/** Prime the core LRU cache with chat avatar fileId from frontend IndexedDB */
export const entityChatAvatarPrimeCacheEvent = defineEventa<{ chatId: string, fileId: string }>('entity:chat-avatar:prime-cache')

// ============================================================================
// Entity notifications (core → client)
// ============================================================================

/** Avatar data for a single user */
export const entityAvatarDataEvent = defineEventa<{
  userId: string
  byte: Uint8Array | { data: number[] }
  mimeType: string
  fileId?: string
}>('entity:avatar:data')
