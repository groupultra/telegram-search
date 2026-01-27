import type { ClientRegisterEventHandlerFn } from '.'

import { useLogger } from '@guiiai/logg'
import { CoreEventType } from '@tg-search/core'

import { useMessageStore } from '../stores/useMessage'

export function registerMessageEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  registerEventHandler(CoreEventType.MessageData, ({ messages }) => {
    useMessageStore().pushMessages(messages)
  })

  registerEventHandler(CoreEventType.MessageUnreadData, ({ messages }) => {
    useLogger('message:unread-data').debug('Received unread messages', messages)
  })

  registerEventHandler(CoreEventType.MessageSummaryData, ({ mode, messages }) => {
    useLogger('message:summary-data').withFields({ mode, count: messages.length }).debug('Received summary messages')
  })
}
