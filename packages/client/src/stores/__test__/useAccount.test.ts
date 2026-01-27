import { CoreEventType } from '@tg-search/core'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAccountStore } from '../useAccount'

// Mock dependencies with strict references
const sendEventMock = vi.fn()
vi.mock('../../composables/useBridge', () => ({
  useBridge: () => ({
    sendEvent: sendEventMock,
  }),
}))

const sessionActions = {
  removeCurrentAccount: vi.fn(),
  switchAccount: vi.fn(),
  addNewAccount: vi.fn(),
}
// We need a way to change activeSession dynamically
let mockActiveSession: any = { session: 'mock-session', uuid: 'mock-uuid', me: { id: 123 } }

vi.mock('../useSession', () => ({
  useSessionStore: vi.fn(() => ({
    get activeSession() { return mockActiveSession },
    ...sessionActions,
    sessions: { 'mock-uuid': { uuid: 'mock-uuid' } },
  })),
}))

const chatActions = {
  fetchStorageDialogs: vi.fn(),
  init: vi.fn(),
}
vi.mock('../useChat', () => ({
  useChatStore: vi.fn(() => chatActions),
}))

const messageActions = {
  reset: vi.fn(),
}
vi.mock('../useMessage', () => ({
  useMessageStore: vi.fn(() => messageActions),
}))

describe('useAccountStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockActiveSession = { session: 'mock-session', uuid: 'mock-uuid', me: { id: 123 } }
  })

  it('initializes correctly', () => {
    const store = useAccountStore()
    expect(store.isReady).toBe(false)
    expect(store.auth).toEqual({
      needCode: false,
      needPassword: false,
      isLoading: false,
    })
  })

  it('attempts login when session exists', async () => {
    const store = useAccountStore()
    await store.init()
    expect(sendEventMock).toHaveBeenCalledWith(CoreEventType.AuthLogin, { session: 'mock-session' })
    expect(store.auth.isLoading).toBe(true)
  })

  it('skips login if no session', async () => {
    // Override session mock for this test
    mockActiveSession = undefined

    const store = useAccountStore()
    await store.init()
    expect(sendEventMock).not.toHaveBeenCalledWith(CoreEventType.AuthLogin, expect.anything())
  })

  it('handleAuth actions send correct events', () => {
    const store = useAccountStore()
    const { login, submitCode, submitPassword, logout } = store.handleAuth()

    login('1234567890')
    expect(sendEventMock).toHaveBeenCalledWith(CoreEventType.AuthLogin, {
      phoneNumber: '1234567890',
      session: 'mock-session',
    })

    submitCode('12345')
    expect(sendEventMock).toHaveBeenCalledWith(CoreEventType.AuthCode, { code: '12345' })

    submitPassword('password')
    // eslint-disable-next-line sonarjs/no-hardcoded-passwords
    expect(sendEventMock).toHaveBeenCalledWith(CoreEventType.AuthPassword, { password: 'password' })

    logout()
    expect(sendEventMock).toHaveBeenCalledWith(CoreEventType.AuthLogout, undefined)
    expect(sessionActions.removeCurrentAccount).toHaveBeenCalled()
  })

  it('marks ready correctly', () => {
    const store = useAccountStore()
    store.markReady()

    expect(store.isReady).toBe(true)
    expect(store.auth.isLoading).toBe(false)
    expect(sendEventMock).toHaveBeenCalledWith(CoreEventType.ConfigFetch)
    expect(chatActions.init).toHaveBeenCalled()
  })

  it('resets ready correctly', () => {
    const store = useAccountStore()
    store.isReady = true
    store.auth.isLoading = true

    store.resetReady()
    expect(store.isReady).toBe(false)
    expect(store.auth.isLoading).toBe(false)
  })

  it('switching account resets message store and ready state', () => {
    const store = useAccountStore()
    const { switchAccount } = store.handleAuth()

    switchAccount('new-uuid')
    expect(messageActions.reset).toHaveBeenCalled()
    expect(sessionActions.switchAccount).toHaveBeenCalledWith('new-uuid')
    expect(store.isReady).toBe(false)
  })
})
