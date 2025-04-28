import type { WsEventToClient } from '@tg-search/server'
import type { WsEventHandler } from '../composables/useWebsocketV2'

import { useChatStore } from '../store/useChat'

export function registerDialogEventHandlers(
  registerEventHandler: <T extends keyof WsEventToClient>(event: T, handler: WsEventHandler<T>) => void,
) {
  const chatStore = useChatStore()

  registerEventHandler('dialog:data', (data) => {
    chatStore.chats = data.dialogs
  })
}
