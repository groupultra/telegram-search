import type { createWebsocketV2Context } from './useWebsocketV2'

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface ConnectionContext extends ReturnType<typeof createWebsocketV2Context> {
  phoneNumber?: string
}

export const useConnectionStore = defineStore('connection', () => {
  const connection = ref(new Map<string, ConnectionContext>())
  const activeSessionId = ref('')

  const activeSession = computed(() => {
    return connection.value.get(activeSessionId.value)
  })

  const setConnection = (clientId: string, context: ConnectionContext) => {
    connection.value.set(clientId, context)
  }

  const getConnection = (clientId: string) => {
    return connection.value.get(clientId)
  }

  return {
    setConnection,
    getConnection,
    activeSession,
    activeSessionId,
  }
})
