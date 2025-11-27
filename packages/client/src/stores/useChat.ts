import type { CoreDialog } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useChatStore = defineStore('chat', () => {
  const computedChatKey = computed(() => `chat/chats/${useBridgeStore().activeSessionId}`)
  const chats = useLocalStorage<CoreDialog[]>(computedChatKey, [])
  const syncedChats = ref<CoreDialog[]>([])

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
    useLogger('ChatStore').log('Init dialogs')

    // Fetch synced chats from database
    if (syncedChats.value.length === 0) {
      // In websocket mode, we explicitly trigger a storage fetch to hydrate
      // dialogs from the server-side database. In core-bridge (browser-core)
      // mode, dialogs are bootstrapped by the core pipeline itself after
      // login, and there is no stable accountId yet when this runs, so we
      // avoid firing storage:fetch:dialogs to prevent "Current account ID not set"
      // noise from the core context.
      if (!import.meta.env.VITE_WITH_CORE)
        useBridgeStore().sendEvent('storage:fetch:dialogs')
    }

    // Fetch all dialogs from Telegram
    if (chats.value.length === 0) {
      useBridgeStore().sendEvent('dialog:fetch')
      // In websocket mode, we explicitly trigger a storage fetch to hydrate
      // dialogs from the server-side database. In core-bridge (browser-core)
      // mode, dialogs are bootstrapped by the core pipeline itself after
      // login, and there is no stable accountId yet when this runs, so we
      // avoid firing storage:fetch:dialogs to prevent "Current account ID not set"
      // noise from the core context.
      if (!import.meta.env.VITE_WITH_CORE)
        useBridgeStore().sendEvent('storage:fetch:dialogs')
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
