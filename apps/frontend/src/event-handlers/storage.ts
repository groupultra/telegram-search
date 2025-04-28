import type { ClientRegisterEventHandler } from '.'

import { useChatStore } from '../store/useChat'

export function registerStorageEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  const chatsStore = useChatStore()

  registerEventHandler('storage:dialogs', (data) => {
    chatsStore.chats = data.dialogs
  })
}
