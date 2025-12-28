import type { CoreUserEntity } from '@tg-search/core'

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed } from 'vue'

import { IS_CORE_MODE } from '../../constants'

const CORE_TYPE = 'core-bridge'
const WS_TYPE = 'websocket'

export interface StoredSession {
  uuid: string
  me?: CoreUserEntity
  session?: string
  type?: 'websocket' | 'core-bridge'
}

export const useSessionStore = defineStore('session', () => {
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

  const addNewAccount = () => {
    const newId = uuidv4()
    sessions.value = {
      ...sessions.value,
      [newId]: createSession(newId),
    }
    activeSessionId.value = newId
    return newId
  }

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

  const switchAccount = (sessionId: string) => {
    if (sessions.value[sessionId]) {
      activeSessionId.value = sessionId
    }
  }

  const updateSession = (sessionId: string, data: Partial<StoredSession>) => {
    if (sessions.value[sessionId]) {
      sessions.value = {
        ...sessions.value,
        [sessionId]: {
          ...sessions.value[sessionId],
          ...data,
        },
      }
    }
  }

  const cleanup = () => {
    sessions.value = {}
    activeSessionId.value = null
  }

  const init = () => {
    ensureSessionInvariants()
  }

  return {
    init,
    sessions,
    activeSessionId,
    activeSession,
    ensureSessionInvariants,
    addNewAccount,
    removeCurrentAccount,
    switchAccount,
    updateSession,
    cleanup,
  }
})
