import type { CoreUserEntity } from '@tg-search/core'

import { useLocalStorage } from '@vueuse/core'
import { defu } from 'defu'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useWebsocketStore } from './useWebsocket'

export interface SessionContext {
  phoneNumber?: string
  isConnected?: boolean
  me?: CoreUserEntity
}

export const useSessionStore = defineStore('session', () => {
  const storageSessions = useLocalStorage('session/sessions', new Map<string, SessionContext>())
  const storageActiveSessionId = useLocalStorage('session/active-session-id', crypto.randomUUID())

  const authStatus = ref({
    needCode: false,
    needPassword: false,
  })

  const activeSessionComputed = computed(() => storageSessions.value.get(storageActiveSessionId.value))
  const isLoggedInComputed = computed(() => activeSessionComputed.value?.isConnected)

  const getActiveSession = () => {
    return storageSessions.value.get(storageActiveSessionId.value)
  }

  const updateActiveSession = (sessionId: string, partialSession: Partial<SessionContext>) => {
    const mergedSession = defu({}, partialSession, storageSessions.value.get(sessionId))

    storageSessions.value.set(sessionId, mergedSession)
    storageActiveSessionId.value = sessionId
  }

  const attemptLogin = async () => {
    const activeSession = getActiveSession()
    if (!activeSession?.isConnected && activeSession?.phoneNumber) {
      handleAuth().login(activeSession.phoneNumber)
    }
  }

  const init = async () => {
    if (!storageActiveSessionId.value || storageActiveSessionId.value === '') {
      storageActiveSessionId.value = crypto.randomUUID()
    }

    await attemptLogin()
  }

  watch(() => activeSessionComputed.value?.isConnected, (isConnected) => {
    if (!isConnected) {
      attemptLogin()
    }
    else {
      const websocketStore = useWebsocketStore()
      websocketStore.sendEvent('entity:me:fetch', undefined)
    }
  })

  function handleAuth() {
    const websocketStore = useWebsocketStore()

    function login(phoneNumber: string) {
      storageSessions.value.get(storageActiveSessionId.value)!.phoneNumber = phoneNumber

      websocketStore.sendEvent('auth:login', {
        phoneNumber,
      })
    }

    function submitCode(code: string) {
      websocketStore.sendEvent('auth:code', {
        code,
      })
    }

    function submitPassword(password: string) {
      websocketStore.sendEvent('auth:password', {
        password,
      })
    }

    function logout() {
      getActiveSession()!.isConnected = false
      websocketStore.sendEvent('auth:logout', undefined)
    }

    return { login, submitCode, submitPassword, logout }
  }

  return {
    init,
    sessions: storageSessions,
    activeSessionId: storageActiveSessionId,
    activeSessionComputed,
    auth: authStatus,
    handleAuth,
    getActiveSession,
    updateActiveSession,
    attemptLogin,
    isLoggedIn: isLoggedInComputed,
  }
})
