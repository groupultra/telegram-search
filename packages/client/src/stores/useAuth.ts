import type { CoreUserEntity } from '@tg-search/core'

import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useBridgeStore } from '../composables/useBridge'
import { useChatStore } from './useChat'

export interface SessionContext {
  phoneNumber?: string
  isConnected?: boolean
  me?: CoreUserEntity
}

export const useAuthStore = defineStore('session', () => {
  const websocketStore = useBridgeStore()

  const authStatus = ref({
    needCode: false,
    needPassword: false,
    isLoading: false,
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
    }
  }, { immediate: true })

  function handleAuth() {
    function login(phoneNumber: string) {
      const activeSessionId = websocketStore.activeSessionId
      const session = websocketStore.getActiveSession()

      if (session) {
        session.phoneNumber = phoneNumber
      }
      else {
        // Create a new session if none exists
        websocketStore.updateActiveSession(activeSessionId, { phoneNumber })
      }

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
      websocketStore.logoutCurrentAccount()
    }

    function switchAccount(sessionId: string) {
      websocketStore.switchAccount(sessionId)
    }

    function addNewAccount() {
      return websocketStore.addNewAccount()
    }

    function getAllAccounts() {
      return websocketStore.getAllSessions()
    }

    return { login, submitCode, submitPassword, logout, switchAccount, addNewAccount, getAllAccounts }
  }

  function init() {
    // Auto login
    // useConfig().api.telegram.autoReconnect && attemptLogin()

    // Initialize chat store to load dialogs from database regardless of authentication status
    useChatStore().init()
  }

  return {
    init,
    activeSessionComputed,
    auth: authStatus,
    handleAuth,
    attemptLogin,
    isLoggedIn: isLoggedInComputed,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
