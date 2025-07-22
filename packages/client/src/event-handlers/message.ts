import type { ClientRegisterEventHandlerFn } from '.'

import { useMessageStore } from '../stores/useMessage'

export function registerMessageEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  registerEventHandler('message:data', ({ messages }) => {
    useMessageStore().pushMessages(messages)
  })
}
