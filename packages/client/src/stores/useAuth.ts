import { useLogger } from '@guiiai/logg'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useAuthStore = defineStore('session', () => {
  const websocketStore = useBridgeStore()

  const authStatus = ref({
    needCode: false,
    needPassword: false,
    isLoading: false,
  })

  const activeSessionComputed = computed(() => websocketStore.getActiveSession())
  const isLoggedInComputed = computed(() => activeSessionComputed.value?.isConnected)

  /**
   * Best-effort auto-login using stored Telegram session string.
   *
   * Rules:
   * - Only runs when there is NO active connection.
   * - Uses the active slot's stored session (if any).
   * - Sends empty phoneNumber because Telegram will skip sign-in flow when
   *   the session is still valid. If the session is invalid, core will emit
   *   auth:error and frontend should fall back to manual login.
   */
  const attemptLogin = async () => {
    useLogger('AuthStore').log('Attempting login')
    const activeSession = websocketStore.getActiveSession()

    if (!activeSession?.isConnected && activeSession?.session) {
      websocketStore.sendEvent('auth:login', {
        phoneNumber: '',
        session: activeSession.session,
      })
    }
  }

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
    // Try to restore connection using stored session for the active slot.
    // If the session is invalid, core will emit auth:error and the user will
    // be guided through manual login as usual.
    // FIXME
    setTimeout(() => void attemptLogin(), 200)
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
