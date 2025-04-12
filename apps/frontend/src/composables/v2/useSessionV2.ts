import type { CoreUserInfo } from '@tg-search/core'
import type { SuccessResponse } from '@tg-search/server'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { onMounted, ref } from 'vue'

import { apiFetch } from '../api'
import { useWebsocketV2 } from './useWebsocketV2'

interface SessionContext {
  phoneNumber?: string
  me?: CoreUserInfo
}

export const useSessionStore = defineStore('session-v2', () => {
  let wsContext: ReturnType<typeof useWebsocketV2>

  const storageSessions = useLocalStorage('session/sessions', new Map<string, SessionContext>())
  const storageActiveSessionId = useLocalStorage('session/active-session-id', '')

  const auth = ref({
    needCode: false,
    needPassword: false,

    isLoggedIn: false,
  })

  const getActiveSession = () => {
    return storageSessions.value.get(storageActiveSessionId.value)
  }

  const setActiveSession = (sessionId: string, session: SessionContext) => {
    if (storageSessions.value.has(sessionId))
      return

    storageSessions.value.set(sessionId, session)
    storageActiveSessionId.value = sessionId
  }

  onMounted(async () => {
    if (!storageActiveSessionId.value) {
      // FIXME: reimplement this
      const response = await apiFetch<SuccessResponse<{ sessionId: string }>>('/v2/session', {
        method: 'POST',
      })

      storageActiveSessionId.value = response.data?.sessionId
    }

    wsContext = useWebsocketV2(storageActiveSessionId.value)
  })

  function handleAuth() {
    function login(phoneNumber: string) {
      storageSessions.value.get(storageActiveSessionId.value)!.phoneNumber = phoneNumber

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
    activeSessionId: storageActiveSessionId,
    auth,
    handleAuth,
    getActiveSession,
    setActiveSession,
  }
})
