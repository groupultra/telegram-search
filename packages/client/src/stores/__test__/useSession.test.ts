import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '../useSession'

// Mock uuid to have predictable IDs
vi.mock('uuid', () => ({
  v4: vi.fn()
    .mockReturnValueOnce('uuid-1')
    .mockReturnValueOnce('uuid-2')
    .mockReturnValueOnce('uuid-3')
    .mockReturnValue('uuid-n'),
}))

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Reset localStorage mock if needed, or rely on Pinia reset
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('initializes with default session if empty', () => {
    const store = useSessionStore()
    store.init()

    expect(store.sessions).toEqual({
      'uuid-1': {
        uuid: 'uuid-1',
        type: expect.any(String), // 'websocket' or 'core-bridge' depending on env
      },
    })
    expect(store.activeSessionId).toBe('uuid-1')
  })

  it('adds a new account', () => {
    const store = useSessionStore()
    store.init() // uuid-1

    const newId = store.addNewAccount() // uuid-2
    expect(newId).toBe('uuid-2')
    expect(store.sessions['uuid-2']).toBeDefined()
    expect(store.activeSessionId).toBe('uuid-2')
    expect(Object.keys(store.sessions)).toHaveLength(2)
  })

  it('switches account', () => {
    const store = useSessionStore()
    store.init() // uuid-1
    store.addNewAccount() // uuid-2

    store.switchAccount('uuid-1')
    expect(store.activeSessionId).toBe('uuid-1')

    store.switchAccount('uuid-2')
    expect(store.activeSessionId).toBe('uuid-2')
  })

  it('removes current account', () => {
    const store = useSessionStore()
    store.init() // uuid-1
    store.addNewAccount() // uuid-2

    // Currently on uuid-2
    const removed = store.removeCurrentAccount()
    expect(removed).toBe(true)
    expect(store.sessions['uuid-2']).toBeUndefined()
    expect(store.activeSessionId).toBe('uuid-1') // Should fall back to remaining session
  })

  it('updates session data', () => {
    const store = useSessionStore()
    store.init() // uuid-1

    store.updateSession('uuid-1', { session: 'session-string' })
    expect(store.sessions['uuid-1'].session).toBe('session-string')
  })

  it('cleanup resets state', () => {
    const store = useSessionStore()
    store.init()
    store.cleanup()

    expect(store.sessions).toEqual({})
    expect(store.activeSessionId).toBeNull()
  })

  it('activeSession computed property works', () => {
    const store = useSessionStore()
    store.init() // uuid-1

    expect(store.activeSession).toBeDefined()
    expect(store.activeSession?.uuid).toBe('uuid-1')

    store.activeSession = { ...store.activeSession!, session: 'new-session' }
    expect(store.sessions['uuid-1'].session).toBe('new-session')
  })
})
