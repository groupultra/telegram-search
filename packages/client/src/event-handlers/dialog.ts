import type { ClientRegisterEventHandlerFn } from '.'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'

import { useAvatarStore } from '../stores/useAvatar'
import { useChatStore } from '../stores/useChat'
import { persistChatAvatar } from '../utils/avatar-cache'
import { bytesToBlob, canDecodeAvatar } from '../utils/image'

/**
 * Register dialog-related client event handlers.
 * Handles base dialog data and incremental avatar bytes -> blobUrl conversion.
 */
export function registerDialogEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  const logger = useLogger('avatars')

  // Base dialog list
  registerEventHandler(CoreEventType.DialogData, (data) => {
    useChatStore().chats = data.dialogs
  })

  // Chat folders
  registerEventHandler(CoreEventType.DialogFoldersData, (data) => {
    useChatStore().folders = data.folders
  })

  /**
   * Incremental avatar updates.
   *
   * Optimization:
   * - Before decoding/optimizing, check in-memory cache validity (TTL + fileId match).
   *   If valid, skip override and persistence to reduce unnecessary work.
   */
  registerEventHandler(CoreEventType.DialogAvatarData, async (data) => {
    const chatStore = useChatStore()
    const avatarStore = useAvatarStore()

    // Early guard: use cached avatar if it's still valid and matches fileId
    if (avatarStore.hasValidChatAvatar(data.chatId, data.fileId)) {
      const chat = chatStore.chats.find(c => c.id === data.chatId)
      if (chat && data.fileId && chat.avatarFileId !== data.fileId)
        chat.avatarFileId = data.fileId
      logger.withFields({ chatId: data.chatId, fileId: data.fileId }).warn('Skip update; cache valid')
      return
    }

    // Reconstruct buffer from JSON-safe payload
    let buffer: Uint8Array | undefined
    try {
      // Type guard to check if byte is an object with data property
      if (typeof data.byte === 'object' && 'data' in data.byte && Array.isArray(data.byte.data))
        buffer = new Uint8Array(data.byte.data)
      else buffer = data.byte as Uint8Array
    }
    catch (error) {
      // Warn-only logging to comply with lint rules
      logger.withFields({ chatId: data.chatId }).withError(error).warn('Failed to reconstruct chat avatar byte')
    }

    if (!buffer) {
      // Use warn to comply with lint rule: allow only warn/error
      logger.withFields({ chatId: data.chatId }).warn('Missing byte for chat avatar')
      return
    }

    // Decode-check: only set src when image is decodable; otherwise let component fallback
    const decodable = await canDecodeAvatar(buffer, data.mimeType)
    if (!decodable) {
      // Signal completion to clear in-flight flag for this chat
      useAvatarStore().markChatFetchCompleted(data.chatId)
      // Clean up ArrayBuffer references to help the GC reclaim memory
      buffer = undefined
      return
    }
    // Convert bytes to Blob and create blob URL
    const blob = bytesToBlob(buffer, data.mimeType)
    const url = URL.createObjectURL(blob)

    // Persist optimized chat avatar
    try {
      await persistChatAvatar(data.chatId, blob, data.mimeType, data.fileId)
    }
    catch (error) {
      // Warn-only logging to comply with lint rules
      logger.withFields({ chatId: data.chatId }).withError(error).warn('persistChatAvatar failed')
    }

    // Update chat store fields
    const chat = chatStore.chats.find(c => c.id === data.chatId)
    if (chat) {
      chat.avatarBlobUrl = url
      if (data.fileId)
        chat.avatarFileId = data.fileId
      chat.avatarUpdatedAt = new Date()
    }

    // Populate centralized avatar cache as well
    avatarStore.setChatAvatar(data.chatId, { blobUrl: url, fileId: data.fileId, mimeType: data.mimeType })

    // Signal completion to clear in-flight flag for this chat
    avatarStore.markChatFetchCompleted(data.chatId)

    // Clean up ArrayBuffer references to help the GC reclaim memory
    buffer = undefined

    logger.withFields({ chatId: data.chatId, fileId: data.fileId }).debug('Updated chat avatar')
  })
}
