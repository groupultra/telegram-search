import type { ClientRegisterEventHandlerFn } from '.'

import { storeToRefs } from 'pinia'

import { useChatStore } from '../store/useChat'

export function registerDialogEventHandlers(
  registerEventHandler: ClientRegisterEventHandlerFn,
) {
  const chatStore = useChatStore()
  const { chats } = storeToRefs(chatStore)

  registerEventHandler('dialog:data', (data) => {
    chats.value = data.dialogs
  })
}
