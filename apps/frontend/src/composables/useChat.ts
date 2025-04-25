import type { CoreDialog } from '@tg-search/core'

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
  const chats = ref<CoreDialog[]>([])

  return { chats }
})
