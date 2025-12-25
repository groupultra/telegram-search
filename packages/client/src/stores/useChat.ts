import type { CoreChatFolder, CoreDialog } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'

import { IS_CORE_MODE } from '../../constants'
import { useBridgeStore } from '../composables/useBridge'

export const useChatStore = defineStore('chat', () => {
  const bridgeStore = useBridgeStore()
  const allChats = useLocalStorage<Record<string, CoreDialog[]>>('v2/chat/chats', {})
  const allFolders = useLocalStorage<Record<string, CoreChatFolder[]>>('v2/chat/folders', {})

  const chats = computed({
    get: () => {
      const userId = bridgeStore.activeSession?.me?.id
      if (!userId)
        return []
      const list = allChats.value[userId] ?? []
      return [...list].sort((a, b) => {
        // Pinned chats first
        if (a.pinned && !b.pinned)
          return -1
        if (!a.pinned && b.pinned)
          return 1

        // Then by last message date
        const dateA = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0
        const dateB = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0
        return dateB - dateA
      })
    },
    set: (v) => {
      const userId = bridgeStore.activeSession?.me?.id
      if (!userId)
        return

      allChats.value = {
        ...allChats.value,
        [userId]: v,
      }
    },
  })

  const folders = computed({
    get: () => {
      const userId = bridgeStore.activeSession?.me?.id
      if (!userId)
        return []
      return allFolders.value[userId] ?? []
    },
    set: (v) => {
      const userId = bridgeStore.activeSession?.me?.id
      if (!userId)
        return

      allFolders.value = {
        ...allFolders.value,
        [userId]: v,
      }
    },
  })

  function getChat(id: string) {
    return chats.value.find(chat => chat.id === Number(id))
  }

  function fetchChats() {
    bridgeStore.sendEvent('dialog:fetch')
  }

  function fetchFolders() {
    bridgeStore.sendEvent('dialog:folders:fetch')
  }

  function init() {
    useLogger('ChatStore').log('Init dialogs')

    if (chats.value.length === 0) {
      // In websocket mode, we explicitly trigger a storage fetch to hydrate
      // dialogs from the server-side database. In core-bridge (browser-core)
      // mode, dialogs are bootstrapped by the core pipeline itself after
      // login, and there is no stable accountId yet when this runs, so we
      // avoid firing storage:fetch:dialogs to prevent "Current account ID not set"
      // noise from the core context.
      if (!IS_CORE_MODE)
        bridgeStore.sendEvent('storage:fetch:dialogs')
    }

    if (folders.value.length === 0)
      fetchFolders()
  }

  return {
    init,
    getChat,
    fetchChats,
    fetchFolders,
    chats,
    folders,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot))
}
