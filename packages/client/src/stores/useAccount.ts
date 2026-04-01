import { useLogger } from '@guiiai/logg'
import { CoreEventType, generateDefaultAccountSettings } from '@tg-search/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useBridge } from '../composables/useBridge'
import { IS_CORE_MODE, TELEGRAM_APP_HASH, TELEGRAM_APP_ID } from '../constants'
import { useChatStore } from './useChat'
import { useMessageStore } from './useMessage'
import { useSessionStore } from './useSession'

export const useAccountStore = defineStore('account', () => {
  const logger = useLogger('AccountStore')
  const bridge = useBridge()
  const sessionStore = useSessionStore()

  // --- Auth State ---
  const authStatus = ref({
    needCode: false,
    needPassword: false,
    isLoading: false,
  })

  const attemptCounter = ref(0)
  const MAX_ATTEMPTS = 3
  let reconnectTimer: number | undefined
  const AUTH_TIMEOUT_MS = 20000
  let authTimeoutTimer: number | undefined

  // --- Account State ---
  const accountSettings = ref(generateDefaultAccountSettings())
  const hasFetchedSettings = ref(false)

  const isReady = ref(false)

  const syncStatus = ref<'idle' | 'syncing' | 'error'>('idle')

  // --- Actions: Auth ---

  /**
   * Best-effort auto-login using stored Telegram session string.
   */
  const attemptLogin = async () => {
    if (!sessionStore.activeSession?.session) {
      logger.verbose('No session, skipping login')
      return
    }

    if (isReady.value) {
      logger.verbose('Account is ready, fetching dialogs')
      useChatStore().fetchStorageDialogs()
      useChatStore().fetchDialogs()
      useChatStore().fetchFolders()
      return
    }

    if (IS_CORE_MODE && (!TELEGRAM_APP_ID || !TELEGRAM_APP_HASH)) {
      toast.error('Missing Telegram API credentials')
      authStatus.value.isLoading = false
      return
    }

    resetReady()
    authStatus.value.isLoading = true
    logger.log('Attempting login')
    bridge.sendEvent(CoreEventType.AuthLogin, { session: sessionStore.activeSession?.session })
  }

  function handleAuth() {
    function login(phoneNumber: string) {
      // NOTICE: session cloud be undefined, we determine it login with phone number as new login
      const session = sessionStore.activeSession?.session
      if (IS_CORE_MODE && (!TELEGRAM_APP_ID || !TELEGRAM_APP_HASH)) {
        toast.error('Missing Telegram API credentials')
        authStatus.value.isLoading = false
        return
      }

      authStatus.value.isLoading = true
      bridge.sendEvent(CoreEventType.AuthLogin, {
        phoneNumber,
        session,
      })
    }

    function submitCode(code: string) {
      bridge.sendEvent(CoreEventType.AuthCode, { code })
    }

    function submitPassword(password: string) {
      bridge.sendEvent(CoreEventType.AuthPassword, { password })
    }

    function logout() {
      // 1. Notify backend (while connection still alive)
      bridge.sendEvent(CoreEventType.AuthLogout, undefined)
      // 2. Remove local session
      sessionStore.removeCurrentAccount()
    }

    function switchAccount(sessionId: string) {
      // When switching accounts, clear message window/state so that chats
      // from the previous account do not bleed into the new one.
      useMessageStore().reset()
      sessionStore.switchAccount(sessionId)
      resetReady()
    }

    function addNewAccount() {
      sessionStore.addNewAccount()
      resetReady()
    }

    function getAllAccounts() {
      return Object.values(sessionStore.sessions)
    }

    return { login, submitCode, submitPassword, logout, switchAccount, addNewAccount, getAllAccounts }
  }

  // --- Actions: Account Lifecycle ---

  function markReady() {
    if (isReady.value)
      return

    logger.verbose('Marking account as ready')
    // NOTICE: config:data forwarding depends on websocket event registration.
    // Requesting immediately here can race with server:event:register on fresh
    // reconnects, so view layers also issue an explicit fetch when needed.
    window.setTimeout(() => {
      logger.verbose('Fetching config for new session')
      bridge.sendEvent(CoreEventType.ConfigFetch)
    }, 150)

    isReady.value = true
    authStatus.value.isLoading = false
    useChatStore().init()
  }

  function resetReady() {
    isReady.value = false
    authStatus.value.isLoading = false
    syncStatus.value = 'idle'
    hasFetchedSettings.value = false
  }

  // --- Watchers ---
  watch(
    () => authStatus.value.isLoading,
    (isLoading) => {
      if (!isLoading) {
        if (authTimeoutTimer) {
          window.clearTimeout(authTimeoutTimer)
          authTimeoutTimer = undefined
        }
        return
      }

      if (authTimeoutTimer)
        window.clearTimeout(authTimeoutTimer)

      authTimeoutTimer = window.setTimeout(() => {
        if (!authStatus.value.isLoading)
          return
        authStatus.value.isLoading = false
        toast.error('Login timed out')
      }, AUTH_TIMEOUT_MS)
    },
  )

  /**
   * Watch the active session's readiness status and handle reconnection logic.
   */
  watch(
    () => isReady.value,
    (isReadyState, prevReady) => {
      const hasSession = !!sessionStore.activeSession?.session

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
    hasFetchedSettings,
    isReady,
    syncStatus,

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
