import type { StoredSession } from '../types/session'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'

import { IS_CORE_MODE } from '../../constants'
import { createSessionStore } from '../utils/session-store'

const CORE_TYPE = 'core-bridge'
const WS_TYPE = 'websocket'

export const useSessionStore = defineStore('client-session', () => {
  // Separate keys for core-bridge (browser) and websocket (server) modes
  // to avoid session pollution between environments.
  const type = IS_CORE_MODE ? CORE_TYPE : WS_TYPE
  const sessionKey = `${type}/sessions`
  const slotKey = `${type}/active-session-slot`

  const storageSessions = useLocalStorage<StoredSession[]>(sessionKey, [])
  const storageActiveSessionSlot = useLocalStorage<number>(slotKey, 0)

  // Use the shared helper logic
  const store = createSessionStore(storageSessions, storageActiveSessionSlot, {
    generateId: () => uuidv4(),
    createSession: uuid => ({
      uuid,
      type,
    }),
  })

  return {
    sessions: storageSessions,
    activeSessionSlot: storageActiveSessionSlot,
    ...store,
  }
})
