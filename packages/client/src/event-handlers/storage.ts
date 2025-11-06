import type { ClientRegisterEventHandler } from '.'

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
  registerEventHandler('storage:dialogs', (data) => {
    const chatStore = useChatStore()
    chatStore.chats = data.dialogs
    // Prefill avatars from persistent cache concurrently for better initial UX
    Promise.resolve().then(async () => {
      try {
        await Promise.all(chatStore.chats.map(chat => prefillChatAvatarIntoStore(chat.id)))
      }
      catch (error) {
        // Warn-only logging to comply with lint rules
        console.warn('[Avatar] Batch prefillChatAvatarIntoStore failed', error)
      }
    })
  })

  registerEventHandler('storage:messages', ({ messages }) => {
    useMessageStore().pushMessages(messages)
  })

  // Wait for result event
  registerEventHandler('storage:search:messages:data', (_) => {})
  registerEventHandler('storage:messages:context', (_) => {})
}
