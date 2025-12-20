import type { StoredSession } from '../types/session'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

import { createSessionStore } from '../utils/session-store'

export const useSessionStore = defineStore('client-session', () => {
  // Separate keys for core-bridge (browser) and websocket (server) modes
  // to avoid session pollution between environments.
  const isCore = import.meta.env.VITE_WITH_CORE
  const sessionKey = isCore ? 'client-core/sessions' : 'client-ws/sessions'
  const slotKey = isCore ? 'client-core/active-session-slot' : 'client-ws/active-session-slot'

  const storageSessions = useLocalStorage<StoredSession[]>(sessionKey, [])
  const storageActiveSessionSlot = useLocalStorage<number>(slotKey, 0)

  // Use the shared helper logic
  const store = createSessionStore(storageSessions, storageActiveSessionSlot, {
    generateId: () => uuidv4(),
    createSession: uuid => ({
      uuid,
      type: isCore ? 'core-bridge' : 'websocket',
    }),
  })

  return {
    sessions: storageSessions,
    activeSessionSlot: storageActiveSessionSlot,
    ...store,
  }
})
