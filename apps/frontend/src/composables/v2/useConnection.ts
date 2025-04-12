import type { SuccessResponse } from '@tg-search/server'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, onMounted, ref } from 'vue'

import { apiFetch } from '../api'
import { useWebsocketV2 } from './useWebsocketV2'

interface ConnectionContext {
  phoneNumber?: string
}

export const useConnectionStore = defineStore('connection', () => {
  let wsContext: ReturnType<typeof useWebsocketV2>

  const storageConnections = useLocalStorage('connection/connections', new Map<string, ConnectionContext>())
  const storageActiveSessionId = useLocalStorage('connection/active-session-id', '')

  const connection = ref(storageConnections.value)
  const auth = ref({
    needCode: false,
    needPassword: false,
    isLoggedIn: false,
  })

  const activeSession = computed(() => {
    return connection.value.get(storageActiveSessionId.value)
  })

  onMounted(async () => {
    if (!storageActiveSessionId.value) {
      const response = await apiFetch<SuccessResponse<{ sessionId: string }>>('/v2/session', {
        method: 'POST',
      })

      storageActiveSessionId.value = response.data?.sessionId
    }

    wsContext = useWebsocketV2(storageActiveSessionId.value)
  })

  const setConnection = (clientId: string, context: ConnectionContext) => {
    connection.value.set(clientId, context)
  }

  const getConnection = (clientId: string) => {
    return connection.value.get(clientId)
  }

  function handleAuth() {
    function login(phoneNumber: string) {
      getConnection(storageActiveSessionId.value)!.phoneNumber = phoneNumber

      wsContext.sendEvent('auth:login', {
        phoneNumber,
      })
    }

    function submitCode(code: string) {
      wsContext.sendEvent('auth:code', {
        code,
      })
    }

    function submitPassword(password: string) {
      wsContext.sendEvent('auth:password', {
        password,
      })
    }

    return { login, submitCode, submitPassword }
  }

  return {
    setConnection,
    getConnection,
    activeSession,
    activeSessionId: storageActiveSessionId,
    auth,
    handleAuth,
  }
})
