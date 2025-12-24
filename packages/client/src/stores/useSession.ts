import type { StoredSession } from '../types/session'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed } from 'vue'

import { IS_CORE_MODE } from '../../constants'

const CORE_TYPE = 'core-bridge'
const WS_TYPE = 'websocket'

export const useSessionStore = defineStore('session', () => {
  // Separate keys for core-bridge (browser) and websocket (server) modes
  // to avoid session pollution between environments.
  const type = IS_CORE_MODE ? CORE_TYPE : WS_TYPE
  const sessionKey = `v2/${type}/sessions`
  const activeIdKey = `v2/${type}/active-session-id`

  const sessions = useLocalStorage<Record<string, StoredSession>>(sessionKey, {})
  const activeSessionId = useLocalStorage<string | null>(activeIdKey, null)

  const _createSession = (uuid: string): StoredSession => {
    return { uuid, type: type as any }
  }

  const ensureSessionInvariants = () => {
    if (typeof sessions.value !== 'object' || sessions.value === null || Array.isArray(sessions.value))
      sessions.value = {}

    const keys = Object.keys(sessions.value)
    if (keys.length === 0) {
      const id = uuidv4()
      sessions.value = { [id]: _createSession(id) }
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
      [newId]: _createSession(newId),
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
