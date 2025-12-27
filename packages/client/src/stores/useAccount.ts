import { useLogger } from '@guiiai/logg'
import { generateDefaultAccountSettings } from '@tg-search/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useBridgeStore } from '../composables/useBridge'
import { useChatStore } from './useChat'
import { useMessageStore } from './useMessage'
import { useSessionStore } from './useSession'

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

  // --- Actions: Auth ---

  /**
   * Best-effort auto-login using stored Telegram session string.
   */
  const attemptLogin = async () => {
    if (isReady.value) {
      if (!useSessionStore().activeSession?.session) {
        logger.verbose('No session, skipping login')
        return
      }

      logger.verbose('Account is ready, fetching dialogs')

      useChatStore().fetchStorageDialogs()
      return
    }

    resetReady()
    logger.log('Attempting login')
    bridgeStore.sendEvent('auth:login', { session: useSessionStore().activeSession?.session })
  }

  function handleAuth() {
    function login(phoneNumber: string) {
      // NOTICE: session cloud be undefined, we determine it login with phone number as new login
      const session = useSessionStore().activeSession?.session

      bridgeStore.sendEvent('auth:login', {
        phoneNumber,
        session,
      })
    }

    function submitCode(code: string) {
      bridgeStore.sendEvent('auth:code', { code })
    }

    function submitPassword(password: string) {
      bridgeStore.sendEvent('auth:password', { password })
    }

    function logout() {
      bridgeStore.logoutCurrentAccount()
    }

    function switchAccount(sessionId: string) {
      // When switching accounts, clear message window/state so that chats
      // from the previous account do not bleed into the new one.
      useMessageStore().reset()
      bridgeStore.switchAccount(sessionId)
      resetReady()
    }

    function addNewAccount() {
      useSessionStore().addNewAccount()
      resetReady()
    }

    function getAllAccounts() {
      return Object.values(useSessionStore().sessions)
    }

    return { login, submitCode, submitPassword, logout, switchAccount, addNewAccount, getAllAccounts }
  }

  // --- Actions: Account Lifecycle ---

  function markReady() {
    if (isReady.value)
      return

    logger.verbose('Marking account as ready (step 1/2)')
    logger.verbose('Fetching config for new session')
    bridgeStore.sendEvent('config:fetch')

    // Trigger post-auth bootstrap (chat loading, etc)
    // isReady will be set to true only after critical data (dialogs) is received
    useChatStore().init()
  }

  /**
   * Called by storage event handler when critical data is loaded.
   * Needs `dialogs` to be loaded.
   */
  function completeBootstrap() {
    if (isReady.value)
      return

    logger.verbose('Bootstrap completed (step 2/2)')
    isReady.value = true
  }

  function resetReady() {
    isReady.value = false
  }

  // --- Watchers ---

  /**
   * Watch the active session's readiness status and handle reconnection logic.
   */
  watch(
    () => isReady.value,
    (isReadyState, prevReady) => {
      const hasSession = !!useSessionStore().activeSession?.session

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
    logger.verbose('Initializing account')
    // Try to restore connection using stored session for the active slot.
    void attemptLogin()
  }

  return {
    // State
    auth: authStatus,
    accountSettings,
    isReady,

    // Actions
    init,
    handleAuth,
    markReady,
    completeBootstrap,
    resetReady,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAccountStore, import.meta.hot))
}
