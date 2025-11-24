import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useBridgeStore } from '../composables/useBridge'
import { useChatStore } from './useChat'

export const useAuthStore = defineStore('session', () => {
  const websocketStore = useBridgeStore()

  const authStatus = ref({
    needCode: false,
    needPassword: false,
    isLoading: false,
  })

  const activeSessionComputed = computed(() => websocketStore.getActiveSession())
  const isLoggedInComputed = computed(() => activeSessionComputed.value?.isConnected)

  // NOTE: auto-login is intentionally opt-in and currently disabled to avoid
  // surprising behavior across multi-account setups. See init() for details.
  const attemptLogin = async () => {}

  watch(() => activeSessionComputed.value?.isConnected, (isConnected) => {
    if (isConnected) {
      websocketStore.sendEvent('entity:me:fetch', undefined)
    }
  }, { immediate: true })

  function handleAuth() {
    function login(phoneNumber: string) {
      const session = websocketStore.getActiveSession()

      websocketStore.sendEvent('auth:login', {
        phoneNumber,
        session: session?.session,
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
