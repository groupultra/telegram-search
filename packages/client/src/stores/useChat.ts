import type { CoreDialog } from '@tg-search/core'

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useChatStore = defineStore('chat', () => {
  const chats = ref<CoreDialog[]>([])
  const websocketStore = useBridgeStore()

  const getChat = (id: string) => {
    return chats.value.find(chat => chat.id === Number(id))
  }

  const init = () => {
    // eslint-disable-next-line no-console
    console.log('[ChatStore] Init dialogs')

    if (chats.value.length === 0) {
      websocketStore.sendEvent('storage:fetch:dialogs')
    }
  }

  return {
    init,
    getChat,
    chats,
  }
})
