import { useLogger } from '@guiiai/logg'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useBridgeStore } from '../composables/useBridge'
import { useMessageStore } from './useMessage'

export const useAuthStore = defineStore('session', () => {
  const logger = useLogger('AuthStore')
  const websocketStore = useBridgeStore()

  const authStatus = ref({
    needCode: false,
    needPassword: false,
    isLoading: false,
  })

  const activeSessionComputed = computed(() => websocketStore.getActiveSession())
  const isLoggedInComputed = computed(() => activeSessionComputed.value?.isConnected)

  const attemptCounter = ref(0)
  const MAX_ATTEMPTS = 3
  let reconnectTimer: number | undefined

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
    const activeSession = websocketStore.getActiveSession()

    if (activeSession?.isConnected || !activeSession?.session) {
      logger.log('No need to login')
      return
    }

    logger.log('Attempting login')
    websocketStore.sendEvent('auth:login', {
      session: activeSession.session,
    })
  }

  /**
   * Watch the active session's connection status and handle reconnection logic.
   */
  watch(
    () => activeSessionComputed.value?.isConnected,
    (isConnected, prevConnected) => {
      const hasSession = !!activeSessionComputed.value?.session

      if (isConnected) {
        // Successful (re)connection: clear any pending reconnects and reset attempts.
        if (reconnectTimer) {
          window.clearTimeout(reconnectTimer)
          reconnectTimer = undefined
        }
        attemptCounter.value = 0
        return
      }

      // Below: disconnected path.
      // Only treat as "unexpected disconnect" when:
      // - we previously had a live connection, and
      // - we still have a stored session (i.e. not a deliberate logout / new empty slot).
      if (!prevConnected || !hasSession) {
        attemptCounter.value = 0
        return
      }

      if (attemptCounter.value >= MAX_ATTEMPTS) {
        toast.error('Failed to reconnect to Telegram')
        return
      }

      attemptCounter.value++

      // Exponential backoff up to 10s between attempts to avoid hammering.
      const delayMs = Math.min(1000 * (2 ** (attemptCounter.value - 1)), 10000)
      reconnectTimer = window.setTimeout(() => {
        void attemptLogin()
      }, delayMs)
    },
  )

  // When switching the active account (slot) or recovering from unexpected
  // disconnects, reconnection is handled by the isConnected watcher above
  // combined with explicit login flows. We intentionally avoid a second
  // watcher on {session,isConnected} to prevent duplicate login attempts.

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
      // When switching accounts, clear message window/state so that chats
      // from the previous account do not bleed into the new one.
      useMessageStore().reset()
      websocketStore.switchAccount(sessionId)
    }

    function addNewAccount() {
      return websocketStore.addNewAccount()
    }

    function getAllAccounts() {
      return websocketStore.sessions
    }

    return { login, submitCode, submitPassword, logout, switchAccount, addNewAccount, getAllAccounts }
  }

  function init() {
    // Try to restore connection using stored session for the active slot.
    // If the session is invalid, core will emit auth:error and the user will
    // be guided through manual login as usual.
    void attemptLogin()
  }

  return {
    init,
    activeSessionComputed,
    auth: authStatus,
    handleAuth,
    isLoggedIn: isLoggedInComputed,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
