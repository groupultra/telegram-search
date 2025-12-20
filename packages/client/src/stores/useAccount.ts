import { useLogger } from '@guiiai/logg'
import { generateDefaultAccountSettings } from '@tg-search/core'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useBridgeStore } from '../composables/useBridge'
import { useMessageStore } from './useMessage'

export const useAccountStore = defineStore('account', () => {
  const logger = useLogger('AccountStore')
  const bridgeStore = useBridgeStore()

  // --- Auth State ---
  const authStatus = ref({
    needCode: false,
    needPassword: false,
    isLoading: false,
  })

  const attemptCounter = ref(0)
  const MAX_ATTEMPTS = 3
  let reconnectTimer: number | undefined

  // --- Account State ---
  const accountSettings = ref(generateDefaultAccountSettings())
  const isReady = ref(false)

  const { activeSession } = storeToRefs(bridgeStore)
  // isLoggedIn is true if the session exists and is marked ready (authenticated)
  const isLoggedInComputed = computed(() => activeSession.value?.isReady)

  // --- Actions: Auth ---

  /**
   * Best-effort auto-login using stored Telegram session string.
   */
  const attemptLogin = async () => {
    const session = activeSession.value

    if (session?.isReady || !session?.session) {
      logger.log('No need to login')
      return
    }

    resetReady()
    logger.log('Attempting login')
    bridgeStore.sendEvent('auth:login', {
      session: session.session,
    })
  }

  function handleAuth() {
    function login(phoneNumber: string) {
      const session = activeSession.value

      bridgeStore.sendEvent('auth:login', {
        phoneNumber,
        session: session?.session,
      })
    }

    function submitCode(code: string) {
      bridgeStore.sendEvent('auth:code', {
        code,
      })
    }

    function submitPassword(password: string) {
      bridgeStore.sendEvent('auth:password', {
        password,
      })
    }

    function logout() {
      bridgeStore.logoutCurrentAccount()
    }

    function switchAccount(sessionId: string) {
      // When switching accounts, clear message window/state so that chats
      // from the previous account do not bleed into the new one.
      useMessageStore().reset()
      bridgeStore.switchAccount(sessionId)
    }

    function addNewAccount() {
      return bridgeStore.addNewAccount()
    }

    function getAllAccounts() {
      return bridgeStore.sessions
    }

    return { login, submitCode, submitPassword, logout, switchAccount, addNewAccount, getAllAccounts }
  }

  // --- Actions: Account Lifecycle ---

  function markReady() {
    if (isReady.value)
      return

    isReady.value = true

    logger.verbose('Fetching config for new session')
    bridgeStore.sendEvent('config:fetch')
  }

  function resetReady() {
    isReady.value = false
  }

  // --- Watchers ---

  /**
   * Watch the active session's readiness status and handle reconnection logic.
   */
  watch(
    () => activeSession.value?.isReady,
    (isReadyState, prevReady) => {
      const hasSession = !!activeSession.value?.session

      if (isReadyState) {
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
      if (!prevReady || !hasSession) {
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

  function init() {
    // Try to restore connection using stored session for the active slot.
    void attemptLogin()
  }

  return {
    // State
    auth: authStatus,
    accountSettings,
    isReady: computed(() => isReady.value),
    isLoggedIn: isLoggedInComputed,
    activeSession,

    // Actions
    init,
    handleAuth,
    markReady,
    resetReady,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAccountStore, import.meta.hot))
}
