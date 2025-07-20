import type { ClientRegisterEventHandlerFn } from '.'

import { useMessageStore } from '../stores/useMessage'
import { determineMessageDirection } from '../utils/messageDirection'

export function registerMessageEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  registerEventHandler('message:data', ({ messages }) => {
    const messageStore = useMessageStore()
    const direction = determineMessageDirection(messages, messageStore.messageWindow)
    messageStore.pushMessages(messages, direction)
  })
}
