import type { TelegramChat } from '@tg-search/core'

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { apiFetch, useApi } from '../composables/api'

export const useChats = defineStore('chats', () => {
  const chats = ref<TelegramChat[]>([])
  const total = ref(0)
  const { loading, error, request } = useApi()

  const exportedChats = computed<TelegramChat[]>(() => {
    return chats.value.filter(chat => chat.messageCount && chat.messageCount > 0)
  })

  /**
   * Load chats from API
   */
  async function loadChats(): Promise<void> {
    try {
      const data = await request<TelegramChat[]>(() =>
        apiFetch('/chats'),
      )
      chats.value = data
    }
    catch (err) {
      console.error('Failed to load chats:', err)
    }
  }

  return {
    chats,
    exportedChats,
    loading,
    error,
    total,
    loadChats,
  }
})
