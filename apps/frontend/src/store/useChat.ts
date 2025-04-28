import type { CoreDialog } from '@tg-search/core'

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useSessionStore } from './useSession'

export const useChatStore = defineStore('chat', () => {
  const chats = ref<CoreDialog[]>([])
  const sessionStore = useSessionStore()
  const { getWsContext } = sessionStore

  const init = () => {
    if (chats.value.length === 0) {
      getWsContext()?.sendEvent('storage:fetch:dialogs')
    }
  }

  return {
    init,
    chats,
  }
})
