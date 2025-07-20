import type { ClientRegisterEventHandler } from '.'

import { useChatStore } from '../stores/useChat'
import { useMessageStore } from '../stores/useMessage'
import { determineMessageDirection } from '../utils/messageDirection'

export function registerStorageEventHandlers(
  registerEventHandler: ClientRegisterEventHandler,
) {
  registerEventHandler('storage:dialogs', (data) => {
    useChatStore().chats = data.dialogs
  })

  registerEventHandler('storage:messages', ({ messages }) => {
    const messageStore = useMessageStore()
    const direction = determineMessageDirection(messages, messageStore.messageWindow)
    messageStore.pushMessages(messages, direction)
  })

  // Wait for result event
  registerEventHandler('storage:search:messages:data', ({ messages: _messages }) => {})
}
