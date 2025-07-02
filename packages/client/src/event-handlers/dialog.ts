import type { ClientRegisterEventHandlerFn } from '.'

import { useChatStore } from '../stores/useChat'

export function registerDialogEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  registerEventHandler('dialog:data', (data) => {
    useChatStore().chats = data.dialogs
  })
}
