import type { CoreUserInfo } from '@tg-search/core'
import type { SuccessResponse } from '@tg-search/server'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, onMounted, ref } from 'vue'

import { apiFetch } from '../api'
import { useWebsocketV2 } from './useWebsocketV2'

export interface SessionContext {
  phoneNumber?: string
  isConnected?: boolean
  me?: CoreUserInfo
}

export const useSessionStore = defineStore('session-v2', () => {
  let wsContext: ReturnType<typeof useWebsocketV2>

  const storageSessions = useLocalStorage('session/sessions', new Map<string, SessionContext>())
  const storageActiveSessionId = useLocalStorage('session/active-session-id', '')

  const auth = ref({
    needCode: false,
    needPassword: false,
  })

  const activeSessionComputed = computed(() => storageSessions.value.get(storageActiveSessionId.value))

  const getWsContext = () => {
    if (!wsContext)
      wsContext = useWebsocketV2(storageActiveSessionId.value)

    return wsContext
  }

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

    // Try to connect to Telegram
    const activeSessionComputed = getActiveSession()
    if (!activeSessionComputed?.isConnected && activeSessionComputed?.phoneNumber) {
      handleAuth().login(activeSessionComputed.phoneNumber)
    }

    if (activeSessionComputed?.isConnected) {
      wsContext.sendEvent('entity:getMe', undefined)
    }
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

    function logout() {
      getActiveSession()!.isConnected = false
      wsContext.sendEvent('auth:logout', undefined)
    }

    return { login, submitCode, submitPassword, logout }
  }

  return {
    sessions: storageSessions,
    activeSessionId: storageActiveSessionId,
    activeSessionComputed,
    auth,
    getWsContext,
    handleAuth,
    getActiveSession,
    setActiveSession,
  }
})
