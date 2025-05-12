import type { ClientRegisterEventHandlerFn } from '.'

import { useMessageStore } from '../store/useMessage'

export function registerMessageEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  const messageStore = useMessageStore()

  registerEventHandler('message:data', ({ messages }) => {
    messageStore.pushMessages(messages)
  })
}
