import type { CoreDialog } from '@tg-search/core'

import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useChatStore = defineStore('chat', () => {
  const chats = ref<CoreDialog[]>([])
  const syncedChats = ref<CoreDialog[]>([])
  const websocketStore = useBridgeStore()

  const getChat = (id: string) => {
    // First try to find in all chats (from Telegram) for most up-to-date info
    const chat = chats.value.find(chat => chat.id === Number(id))
    if (chat) {
      return chat
    }
    // If not found, try synced chats (from database)
    // This handles cases where a chat was synced but no longer in active dialogs
    return syncedChats.value.find(chat => chat.id === Number(id))
  }

  const init = () => {
    // eslint-disable-next-line no-console
    console.log('[ChatStore] Init dialogs')

    // Fetch synced chats from database
    if (syncedChats.value.length === 0) {
      websocketStore.sendEvent('storage:fetch:dialogs')
    }

    // Fetch all dialogs from Telegram
    if (chats.value.length === 0) {
      websocketStore.sendEvent('dialog:fetch')
    }
  }

  return {
    init,
    getChat,
    chats,
    syncedChats,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot))
}
