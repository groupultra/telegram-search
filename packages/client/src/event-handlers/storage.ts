import type { ClientRegisterEventHandler } from '.'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'

import { useChatStore } from '../stores/useChat'
import { useMessageStore } from '../stores/useMessage'
import { prefillChatAvatarIntoStore } from '../utils/avatar-cache'

/**
 * Register storage-related client event handlers.
 * Handles dialogs/messages hydration and batch-prefills chat avatars from IndexedDB for faster initial UX.
 */
export function registerStorageEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler(CoreEventType.StorageDialogs, (data) => {
    const chatStore = useChatStore()
    chatStore.chats = data.dialogs
    // Prefill avatars from persistent cache concurrently for better initial UX
    Promise.resolve().then(async () => {
      try {
        await Promise.all(chatStore.chats.map(chat => prefillChatAvatarIntoStore(chat.id)))
      }
      catch (error) {
        // Warn-only logging to comply with lint rules
        useLogger('storage:dialogs').withError(error).warn('Batch prefillChatAvatarIntoStore failed')
      }
    })
  })

  registerEventHandler(CoreEventType.StorageMessages, ({ messages }) => {
    useMessageStore().pushMessages(messages)
  })

  // Wait for result event
  registerEventHandler(CoreEventType.StorageSearchMessagesData, (_) => {})
  registerEventHandler(CoreEventType.StorageMessagesContext, (_) => {})
  registerEventHandler(CoreEventType.StorageChatNoteData, (_) => {})
  registerEventHandler(CoreEventType.StorageSearchPhotosData, (_) => {})
}
