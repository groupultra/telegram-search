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

  function useAuth() {
    const needCode = ref(false)
    const needPassword = ref(false)

    const isLoggedIn = ref(false)

    function login(phoneNumber: string) {
      activeSession.value?.sendEvent('auth:login', {
        phoneNumber,
      })
    }

    function submitCode(code: string) {
      activeSession.value?.sendEvent('auth:code', {
        code,
      })
    }

    function submitPassword(password: string) {
      activeSession.value?.sendEvent('auth:password', {
        password,
      })
    }

    return {
      needCode,
      needPassword,
      isLoggedIn,
      login,
      submitCode,
      submitPassword,
    }
  }

  return {
    setConnection,
    getConnection,
    activeSession,
    activeSessionId,
    useAuth,
  }
})
