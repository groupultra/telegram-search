import type { StoredSession } from '../types/session'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

import { createSessionStore } from '../utils/session-store'

export const useSessionStore = defineStore('client-session', () => {
  // Unified keys for sharing session state between adapters
  const storageSessions = useLocalStorage<StoredSession[]>('client/sessions', [])
  const storageActiveSessionSlot = useLocalStorage<number>('client/active-session-slot', 0)

  // Use the shared helper logic
  const store = createSessionStore(storageSessions, storageActiveSessionSlot, {
    generateId: () => uuidv4(),
  })

  return {
    sessions: storageSessions,
    activeSessionSlot: storageActiveSessionSlot,
    ...store,
  }
})
