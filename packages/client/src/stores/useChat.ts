import type { CoreChatFolder, CoreDialog } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'
import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useChatStore = defineStore('chat', () => {
  const bridgeStore = useBridgeStore()
  const allChats = useLocalStorage<Record<string, CoreDialog[]>>('v2/chat/chats', {})
  const allFolders = useLocalStorage<Record<string, CoreChatFolder[]>>('v2/chat/folders', {})
  const logger = useLogger('ChatStore')

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
    logger.log('Fetching chats')
    bridgeStore.sendEvent('dialog:fetch')
  }

  function fetchFolders() {
    logger.log('Fetching folders')
    bridgeStore.sendEvent('dialog:folders:fetch')
  }

  function init() {
    logger.log('Init dialogs')

    bridgeStore.sendEvent('storage:fetch:dialogs')
    fetchChats()
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
