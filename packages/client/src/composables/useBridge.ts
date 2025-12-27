import type { BridgeStore } from '../types/bridge'

import { defineStore, storeToRefs } from 'pinia'

import { IS_CORE_MODE } from '../../constants'
import { useCoreBridgeAdapter } from '../adapters/core-bridge'
import { useWebsocketAdapter } from '../adapters/websocket'
import { useSessionStore } from '../stores/useSession'

export const useBridgeStore = defineStore('bridge-main', () => {
  const sessionStore = useSessionStore()
  const { sessions, activeSessionId, activeSession } = storeToRefs(sessionStore)

  // Select adapter based on mode
  const adapter = IS_CORE_MODE ? useCoreBridgeAdapter() : useWebsocketAdapter()

  const init = () => {
    sessionStore.ensureSessionInvariants()
    adapter.init()
  }

  const switchAccount = (sessionId: string) => {
    // This updates activeSessionId, which the adapter watches
    sessionStore.switchAccount(sessionId)
  }

  const applySessionUpdate = (session: string) => {
    if (activeSessionId.value) {
      sessionStore.updateSession(activeSessionId.value, { session })
    }
  }

  const logoutCurrentAccount = async () => {
    // 1. Notify backend (while connection still alive)
    adapter.sendEvent('auth:logout', undefined)
    // 2. Remove local session
    sessionStore.removeCurrentAccount()
  }

  return {
    init,

    // Session State
    sessions,
    activeSessionId,
    activeSession,

    // Session Actions
    switchAccount,
    applySessionUpdate,
    logoutCurrentAccount,
    addNewAccount: sessionStore.addNewAccount,
    cleanup: sessionStore.cleanup,

    // Protocol Actions
    sendEvent: adapter.sendEvent,
    waitForEvent: adapter.waitForEvent,
  } satisfies BridgeStore
})
