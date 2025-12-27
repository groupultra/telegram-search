import type { CoreUserEntity } from '@tg-search/core'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed } from 'vue'

import { IS_CORE_MODE } from '../../constants'

const CORE_TYPE = 'core-bridge'
const WS_TYPE = 'websocket'

/**
 * Persistent session representation in localStorage.
 * Flattens metadata and core session info.
 */
export interface StoredSession {
  uuid: string

  me?: CoreUserEntity

  /**
   * Telegram StringSession managed on the client side.
   * Core never persists this; it only forwards updated values.
   */
  session?: string

  /**
   * Type of the session (websocket or core-bridge).
   * Used to distinguish between sessions in different modes.
   */
  type?: 'websocket' | 'core-bridge'
}

// Deprecated alias for backward compatibility during refactor, if needed
export type SessionContext = Partial<Omit<StoredSession, 'uuid'>>

export const useSessionStore = defineStore('session', () => {
  // Separate keys for core-bridge (browser) and websocket (server) modes
  // to avoid session pollution between environments.
  const type = IS_CORE_MODE ? CORE_TYPE : WS_TYPE
  const sessionKey = `v2/${type}/sessions`
  const activeIdKey = `v2/${type}/active-session-id`

  const sessions = useLocalStorage<Record<string, StoredSession>>(sessionKey, {})
  const activeSessionId = useLocalStorage<string | null>(activeIdKey, null)

  const createSession = (uuid: string): StoredSession => {
    return { uuid, type }
  }

  const ensureSessionInvariants = () => {
    if (typeof sessions.value !== 'object' || sessions.value === null || Array.isArray(sessions.value))
      sessions.value = {}

    const keys = Object.keys(sessions.value)
    if (keys.length === 0) {
      const id = uuidv4()
      sessions.value = { [id]: createSession(id) }
      activeSessionId.value = id
      return
    }

    if (!activeSessionId.value || !sessions.value[activeSessionId.value])
      activeSessionId.value = keys[0]
  }

  /**
   * Writable computed for the currently active session.
   */
  const activeSession = computed({
    get: () => {
      if (!activeSessionId.value)
        return undefined
      return sessions.value[activeSessionId.value]
    },
    set: (val) => {
      if (!val || !activeSessionId.value)
        return
      sessions.value = {
        ...sessions.value,
        [activeSessionId.value]: val,
      }
    },
  })

  /**
   * Create a brand new slot and switch to it.
   */
  const addNewAccount = () => {
    const newId = uuidv4()
    sessions.value = {
      ...sessions.value,
      [newId]: createSession(newId),
    }

    activeSessionId.value = newId

    return newId
  }

  /**
   * Remove the current active account slot, adjusting the active index.
   * Returns true if a slot was removed, false otherwise.
   */
  const removeCurrentAccount = () => {
    const id = activeSessionId.value
    if (!id || !sessions.value[id])
      return false

    const newSessions = { ...sessions.value }
    delete newSessions[id]
    sessions.value = newSessions

    const keys = Object.keys(newSessions)
    if (keys.length === 0) {
      activeSessionId.value = null
    }
    else {
      activeSessionId.value = keys[0]
    }

    return true
  }

  const cleanup = () => {
    sessions.value = {}
    activeSessionId.value = null
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    ensureSessionInvariants,
    addNewAccount,
    removeCurrentAccount,
    cleanup,
  }
})
