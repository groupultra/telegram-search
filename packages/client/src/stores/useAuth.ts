import type { CoreUserEntity } from '@tg-search/core'

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useChatStore } from './useChat'
import { useWebsocketStore } from './useWebsocket'

export interface SessionContext {
  phoneNumber?: string
  isConnected?: boolean
  me?: CoreUserEntity
}

export const useAuthStore = defineStore('session', () => {
  const websocketStore = useWebsocketStore()

  const authStatus = ref({
    needCode: false,
    needPassword: false,
  })

  const activeSessionComputed = computed(() => websocketStore.getActiveSession())
  const isLoggedInComputed = computed(() => activeSessionComputed.value?.isConnected)

  const attemptLogin = async () => {
    const activeSession = websocketStore.getActiveSession()
    if (!activeSession?.isConnected && activeSession?.phoneNumber) {
      handleAuth().login(activeSession.phoneNumber)
    }
  }

  watch(() => activeSessionComputed.value?.isConnected, (isConnected) => {
    if (isConnected) {
      websocketStore.sendEvent('entity:me:fetch', undefined)
      useChatStore().init()
    }
  }, { immediate: true })

  function handleAuth() {
    function login(phoneNumber: string) {
      const session = websocketStore.sessions.get(websocketStore.activeSessionId)

      if (session)
        session!.phoneNumber = phoneNumber

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
      websocketStore.getActiveSession()!.isConnected = false
      websocketStore.sendEvent('auth:logout', undefined)
      websocketStore.cleanup()
    }

    return { login, submitCode, submitPassword, logout }
  }

  return {
    activeSessionComputed,
    auth: authStatus,
    handleAuth,
    attemptLogin,
    isLoggedIn: isLoggedInComputed,
  }
})
