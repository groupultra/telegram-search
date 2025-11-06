import type { ClientRegisterEventHandlerFn } from '.'

import { useAvatarStore } from '../stores/useAvatar'
import { useChatStore } from '../stores/useChat'
import { persistChatAvatar } from '../utils/avatar-cache'
import { optimizeAvatarBlob } from '../utils/image'

/**
 * Register dialog-related client event handlers.
 * Handles base dialog data and incremental avatar bytes -> blobUrl conversion.
 */
export function registerDialogEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  // Base dialog list
  registerEventHandler('dialog:data', (data) => {
    useChatStore().chats = data.dialogs
  })

  /**
   * Incremental avatar updates.
   *
   * Optimization:
   * - Before decoding/optimizing, check in-memory cache validity (TTL + fileId match).
   *   If valid, skip override and persistence to reduce unnecessary work.
   */
  registerEventHandler('dialog:avatar:data', async (data) => {
    const chatStore = useChatStore()
    const avatarStore = useAvatarStore()

    // Early guard: use cached avatar if it's still valid and matches fileId
    if (avatarStore.hasValidChatAvatar(data.chatId, data.fileId)) {
      const chat = chatStore.chats.find(c => c.id === data.chatId)
      if (chat && data.fileId && chat.avatarFileId !== data.fileId)
        chat.avatarFileId = data.fileId
      console.warn('[Avatar] Skip update; cache valid', { chatId: data.chatId, fileId: data.fileId })
      return
    }

    // Reconstruct buffer from JSON-safe payload
    let buffer: Uint8Array | undefined
    try {
      if ((data.byte as any)?.data?.length)
        buffer = new Uint8Array((data.byte as any).data)
      else buffer = data.byte as Uint8Array
    }
    catch (error) {
      // Warn-only logging to comply with lint rules
      console.warn('[Avatar] Failed to reconstruct chat avatar byte', { chatId: data.chatId }, error)
    }

    if (!buffer) {
      // Use warn to comply with lint rule: allow only warn/error
      console.warn('[Avatar] Missing byte for chat avatar')
      return
    }

    // Optimize and create blob URL
    const blob = await optimizeAvatarBlob(buffer, data.mimeType)
    const url = URL.createObjectURL(blob)

    // Persist optimized chat avatar
    try {
      await persistChatAvatar(data.chatId, blob, data.mimeType)
    }
    catch (error) {
      // Warn-only logging to comply with lint rules
      console.warn('[Avatar] persistChatAvatar failed', { chatId: data.chatId }, error)
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

    console.warn('[Avatar] Updated chat avatar', { chatId: data.chatId, fileId: data.fileId })
  })
}
