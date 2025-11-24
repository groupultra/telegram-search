import type { CoreDialog } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useChatStore = defineStore('chat', () => {
  const computedChatKey = computed(() => `chat/chats/${useBridgeStore().activeSessionId}`)
  const chats = useLocalStorage<CoreDialog[]>(computedChatKey, [])

  const getChat = (id: string) => {
    return chats.value.find(chat => chat.id === Number(id))
  }

  const init = () => {
    useLogger('ChatStore').log('Init dialogs')

    if (chats.value.length === 0) {
      useBridgeStore().sendEvent('storage:fetch:dialogs')
    }
  }

  return {
    init,
    getChat,
    chats,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot))
}
