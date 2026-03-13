import type { ClientRegisterEventHandlerFn } from '.'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'

import { useChatStore } from '../stores/useChat'
import { useMessageStore } from '../stores/useMessage'
import { useSessionStore } from '../stores/useSession'

export function registerMessageEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  registerEventHandler(CoreEventType.MessageData, ({ messages }) => {
    const messageStore = useMessageStore()
    const sessionStore = useSessionStore()

    const containsRealtimeEdit = messages.some(message => messageStore.isMessageMarkedEdited(message))
    useChatStore().updateChatPreviewFromMessages(messages, {
      activeChatId: messageStore.chatId.value,
      currentUserId: sessionStore.activeSession?.me?.id?.toString(),
      incrementUnread: messages.length === 1 && !containsRealtimeEdit,
    })
    useMessageStore().pushMessages(messages)
  })

  registerEventHandler(CoreEventType.MessageUpdated, ({ chatId, messageId }) => {
    useMessageStore().queueRealtimeEditHint(chatId, messageId)
  })

  registerEventHandler(CoreEventType.MessageDeleted, ({ chatId, messageIds }) => {
    useMessageStore().startDeletingMessages(chatId, messageIds)
  })

  registerEventHandler(CoreEventType.MessageUnreadData, ({ messages }) => {
    useLogger('message:unread-data').debug('Received unread messages', messages)
    const messageStore = useMessageStore()
    const sessionStore = useSessionStore()
    useChatStore().updateChatPreviewFromMessages(messages, {
      activeChatId: messageStore.chatId.value,
      currentUserId: sessionStore.activeSession?.me?.id?.toString(),
      incrementUnread: true,
    })
  })

  registerEventHandler(CoreEventType.MessageSummaryData, ({ mode, messages }) => {
    useLogger('message:summary-data').withFields({ mode, count: messages.length }).debug('Received summary messages')
  })
}
