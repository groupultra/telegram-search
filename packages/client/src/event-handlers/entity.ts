import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'
import { storeToRefs } from 'pinia'

import { useAvatarStore } from '../stores/useAvatar'
import { useSessionStore } from '../stores/useSession'
import { persistUserAvatar } from '../utils/avatar-cache'
import { bytesToBlob, canDecodeAvatar } from '../utils/image'

/**
 * Register entity-related client event handlers.
 * Maps core events to client stores and performs avatar byte -> blobUrl conversion.
 */
export function registerEntityEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler(CoreEventType.EntityMeData, (data) => {
    const { activeSession } = storeToRefs(useSessionStore())

    if (activeSession.value)
      activeSession.value.me = data
  })

  // User avatar bytes -> blob url
  registerEventHandler(CoreEventType.EntityAvatarData, async (data: { userId: string, byte: Uint8Array | { data: number[] }, mimeType: string, fileId?: string }) => {
    const avatarStore = useAvatarStore()

    let buffer: Uint8Array | undefined
    try {
      // Type guard to check if byte is an object with data property
      if (typeof data.byte === 'object' && 'data' in data.byte && Array.isArray(data.byte.data))
        buffer = new Uint8Array(data.byte.data)
      else buffer = data.byte as Uint8Array
    }
    catch (error) {
      // Warn-only logging to comply with lint rules
      useLogger('avatars').withError(error).warn('Failed to reconstruct user avatar byte', { userId: data.userId })
    }

    if (!buffer) {
      // Clear in-flight flag to avoid repeated sends
      avatarStore.markUserFetchCompleted(data.userId)
      return
    }

    // Decode-check: only set src when image is decodable; otherwise let component fallback
    const decodable = await canDecodeAvatar(buffer, data.mimeType)
    if (!decodable) {
      // Clear in-flight flag even if image is not decodable
      avatarStore.markUserFetchCompleted(data.userId)
      // Clean up ArrayBuffer references to help the GC reclaim memory
      buffer = undefined
      return
    }
    // Convert bytes to Blob directly (optimization step removed)
    const blob = bytesToBlob(buffer, data.mimeType)
    const url = URL.createObjectURL(blob)

    // Persist optimized blob into IndexedDB for cache-first load next time
    try {
      await persistUserAvatar(data.userId, blob, data.mimeType, data.fileId)
    }
    catch (error) {
      // Warn-only logging to comply with lint rules
      useLogger('avatars').withError(error).warn('persistUserAvatar failed', { userId: data.userId })
    }

    avatarStore.setUserAvatar(data.userId, { blobUrl: url, fileId: data.fileId, mimeType: data.mimeType })

    // Clear in-flight flag after successful update
    avatarStore.markUserFetchCompleted(data.userId)

    // Clean up ArrayBuffer references to help the GC reclaim memory
    buffer = undefined

    useLogger('avatars').withFields({ userId: data.userId, fileId: data.fileId }).debug('Updated user avatar')
  })
}
