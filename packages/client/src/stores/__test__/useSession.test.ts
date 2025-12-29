import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '../useSession'

// Mock uuid to have predictable IDs
const uuidMock = vi.fn()
vi.mock('uuid', () => ({
  v4: () => uuidMock(),
}))

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Reset localStorage
    localStorage.clear()
    vi.clearAllMocks()

    // Reset uuid sequence
    uuidMock.mockReset()
    uuidMock
      .mockReturnValueOnce('uuid-1')
      .mockReturnValueOnce('uuid-2')
      .mockReturnValueOnce('uuid-3')
      .mockReturnValue('uuid-n')
  })

  it('initializes with default session if empty', () => {
    const store = useSessionStore()
    store.init()

    expect(store.sessions).toEqual({
      'uuid-1': {
        uuid: 'uuid-1',
        type: expect.any(String),
      },
    })
    expect(store.activeSessionId).toBe('uuid-1')
  })

  it('adds a new account', () => {
    const store = useSessionStore()
    store.init() // Uses uuid-1

    const newId = store.addNewAccount() // Uses uuid-2
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

    // Currently on uuid-2 (from addNewAccount)
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
