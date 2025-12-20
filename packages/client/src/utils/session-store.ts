import type { Ref } from 'vue'

import type { StoredSession } from '../types/session'

import { computed } from 'vue'

interface SessionStoreOptions {
  generateId: () => string
  createSession?: (uuid: string) => StoredSession
}

/**
 * Shared helper for managing multi-account session slots.
 * Keeps the WebSocket and core-bridge adapters in sync.
 */
export function createSessionStore(
  sessions: Ref<StoredSession[]>,
  activeSlot: Ref<number>,
  options: SessionStoreOptions,
) {
  const { generateId, createSession } = options

  const _createSession = (uuid: string): StoredSession => {
    if (createSession)
      return createSession(uuid)
    return { uuid }
  }

  const ensureSessionInvariants = () => {
    if (!Array.isArray(sessions.value))
      sessions.value = []

    if (sessions.value.length === 0) {
      sessions.value = [_createSession(generateId())]
      activeSlot.value = 0
      return
    }

    if (activeSlot.value < 0 || activeSlot.value >= sessions.value.length)
      activeSlot.value = 0
  }

  const activeSession = computed({
    get: () => {
      const slot = activeSlot.value
      // Ensure we return a valid object if slot is valid, but handle out-of-bounds gracefully
      return sessions.value[slot]
    },
    set: (val) => {
      if (!val)
        return
      const slot = activeSlot.value
      if (sessions.value[slot]) {
        const copy = [...sessions.value]
        copy[slot] = val
        sessions.value = copy
      }
    },
  })

  /**
   * Update a specific session identified by its uuid.
   * Replaces the session object with a merged version if patch is partial,
   * or fully replaces if the caller handles merging.
   *
   * @param sessionId - The UUID of the session to update
   * @param updateFn - Function that takes current session and returns new session
   */
  const updateSession = (sessionId: string, updateFn: (prev: StoredSession) => StoredSession) => {
    const index = sessions.value.findIndex(s => s.uuid === sessionId)
    if (index === -1)
      return

    const prev = sessions.value[index]
    const next = updateFn(prev)

    const copy = [...sessions.value]
    copy[index] = next
    sessions.value = copy
  }

  /**
   * Create a brand new slot and switch to it.
   */
  const addNewAccount = () => {
    const newId = generateId()
    const sessionsCopy = [...sessions.value, _createSession(newId)]

    sessions.value = sessionsCopy
    activeSlot.value = sessionsCopy.length - 1

    return newId
  }

  /**
   * Remove the current active account slot, adjusting the active index.
   * Returns true if a slot was removed, false otherwise.
   */
  const removeCurrentAccount = () => {
    const index = activeSlot.value
    const currentSessions = sessions.value

    if (index < 0 || index >= currentSessions.length)
      return false

    const newSessions = [...currentSessions.slice(0, index), ...currentSessions.slice(index + 1)]
    sessions.value = newSessions

    if (newSessions.length === 0) {
      activeSlot.value = 0
    }
    else if (index >= newSessions.length) {
      activeSlot.value = newSessions.length - 1
    }
    else {
      activeSlot.value = index
    }

    return true
  }

  const cleanup = () => {
    sessions.value = []
    activeSlot.value = 0
  }

  return {
    ensureSessionInvariants,
    activeSession,
    updateSession,
    addNewAccount,
    removeCurrentAccount,
    cleanup,
  }
}
