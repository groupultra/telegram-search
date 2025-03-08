import { ref } from 'vue'

import { apiRequest, useApi } from '../composables/api'

export function useExportedChats() {
  const exportedChats = ref<Set<number>>(new Set())
  const { request } = useApi()

  async function loadExportedChats() {
    try {
      const response = await request<{ chatIds: number[] }>(() => {
        return apiRequest<{ chatIds: number[] }>('/api/chats/exported')
      })
      exportedChats.value = new Set(response.chatIds)
    }
    catch (error) {
      console.error('Failed to load exported chats:', error)
      exportedChats.value = new Set()
    }
  }

  return {
    exportedChats,
    loadExportedChats,
  }
}
