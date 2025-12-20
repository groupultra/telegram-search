import type { CoreDialog } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useChatStore = defineStore('chat', () => {
  const bridgeStore = useBridgeStore()
  const allChats = useLocalStorage<Record<string, CoreDialog[]>>('chat/chats', {})

  const chats = computed({
    get: () => {
      const sessionId = bridgeStore.activeSessionId
      if (!sessionId)
        return []
      return allChats.value[sessionId] ?? []
    },
    set: (v) => {
      const sessionId = bridgeStore.activeSessionId
      if (!sessionId)
        return

      allChats.value = {
        ...allChats.value,
        [sessionId]: v,
      }
    },
  })

  const getChat = (id: string) => {
    return chats.value.find(chat => chat.id === Number(id))
  }

  const init = () => {
    useLogger('ChatStore').log('Init dialogs')

    if (chats.value.length === 0) {
      // In websocket mode, we explicitly trigger a storage fetch to hydrate
      // dialogs from the server-side database. In core-bridge (browser-core)
      // mode, dialogs are bootstrapped by the core pipeline itself after
      // login, and there is no stable accountId yet when this runs, so we
      // avoid firing storage:fetch:dialogs to prevent "Current account ID not set"
      // noise from the core context.
      if (!import.meta.env.VITE_WITH_CORE)
        bridgeStore.sendEvent('storage:fetch:dialogs')
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
