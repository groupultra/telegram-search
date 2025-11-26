import type { Ref } from 'vue'

import type { SessionContext, StoredSession } from '../types/session'

interface SessionStoreOptions {
  generateId: () => string
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
  const { generateId } = options

  const ensureSessionInvariants = () => {
    if (!Array.isArray(sessions.value))
      sessions.value = []

    if (sessions.value.length === 0) {
      sessions.value = [{
        uuid: generateId(),
        metadata: {},
      }]
      activeSlot.value = 0
      return
    }

    if (activeSlot.value < 0 || activeSlot.value >= sessions.value.length)
      activeSlot.value = 0
  }

  const getActiveSession = () => {
    const slot = activeSlot.value
    return sessions.value[slot]?.metadata
  }

  /**
   * Update metadata for the active session slot by shallow-merging the patch.
   */
  const updateActiveSessionMetadata = (patch: Partial<SessionContext>) => {
    const index = activeSlot.value
    const existing = sessions.value[index]
    if (!existing)
      return

    const mergedMetadata: SessionContext = {
      ...(existing.metadata ?? {}),
      ...patch,
    }

    const sessionsCopy = [...sessions.value]
    sessionsCopy[index] = {
      ...existing,
      metadata: mergedMetadata,
    }
    sessions.value = sessionsCopy
  }

  /**
   * Update metadata for a specific session identified by its uuid.
   * Does nothing if the session does not exist.
   */
  const updateSessionMetadataById = (sessionId: string, patch: Partial<SessionContext>) => {
    if (!sessionId)
      return

    const index = sessions.value.findIndex(session => session.uuid === sessionId)
    if (index === -1)
      return

    const existing = sessions.value[index]
    const mergedMetadata: SessionContext = {
      ...(existing.metadata ?? {}),
      ...patch,
    }

    const sessionsCopy = [...sessions.value]
    sessionsCopy[index] = {
      ...existing,
      metadata: mergedMetadata,
    }
    sessions.value = sessionsCopy
  }

  /**
   * Create a brand new slot and switch to it.
   */
  const addNewAccount = () => {
    const newId = generateId()
    const sessionsCopy = [...sessions.value, {
      uuid: newId,
      metadata: {},
    } satisfies StoredSession]

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
    getActiveSession,
    updateActiveSessionMetadata,
    updateSessionMetadataById,
    addNewAccount,
    removeCurrentAccount,
    cleanup,
  }
}
