import { CoreEventType } from '@tg-search/core'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useAccountStore } from '../../stores/useAccount'
import { useSessionStore } from '../../stores/useSession'
import { useWebsocketAdapter } from '../websocket'

class TestSocket extends EventTarget {
  static readonly OPEN = 1
  static readonly sockets: TestSocket[] = []
  readyState = 0
  sent: string[] = []
  onopen?: () => void
  onclose?: () => void
  onmessage?: (event: { data: string }) => void

  constructor(public url: string) {
    super()
    TestSocket.sockets.push(this)
  }

  open() {
    this.readyState = 1
    this.onopen?.()
  }

  close() {
    this.readyState = 3
    queueMicrotask(() => this.onclose?.())
  }

  send(data: string) {
    this.sent.push(data)
  }

  async receive(type: string, data?: unknown) {
    this.onmessage?.({ data: JSON.stringify({ type, data }) })
    await nextTick()
  }

  logins() {
    return this.sent.map(data => JSON.parse(data)).filter(event => event.type === CoreEventType.AuthLogin)
  }
}

describe('webSocket session recovery', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', TestSocket)
    TestSocket.sockets.length = 0
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
    const sessions = useSessionStore()
    sessions.init()
    sessions.updateSession(sessions.activeSessionId!, { session: 'saved-session' })
    useWebsocketAdapter()
  })

  afterEach(() => {
    disposePinia(pinia)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function connect(accountReady = false) {
    const socket = TestSocket.sockets.at(-1)!
    socket.open()
    await socket.receive('server:connected', {
      sessionId: useSessionStore().activeSessionId,
      accountReady,
    })
    return socket
  }

  it('reconnects after repeated transport failures without changing the stored session', async () => {
    const first = await connect()
    first.close()
    await vi.advanceTimersByTimeAsync(2000)
    expect(TestSocket.sockets).toHaveLength(2)
    TestSocket.sockets[1].close()
    await vi.advanceTimersByTimeAsync(2000)
    expect(TestSocket.sockets).toHaveLength(3)
    const recovered = await connect()
    expect(recovered.url).toBe(first.url)
    expect(recovered.logins()).toEqual([{ type: CoreEventType.AuthLogin, data: { session: 'saved-session' } }])
    expect(useSessionStore().activeSession?.session).toBe('saved-session')
  })

  it('restores a saved session on an unready server even when readiness was already false', async () => {
    const socket = await connect()
    useAccountStore().init()
    expect(socket.logins()).toHaveLength(1)
    expect(socket.sent.findIndex(data => JSON.parse(data).type === 'server:event:register'))
      .toBeLessThan(socket.sent.findIndex(data => JSON.parse(data).type === CoreEventType.AuthLogin))
  })

  it('replaces a silent connection after a missed heartbeat', async () => {
    const socket = await connect()
    await vi.advanceTimersByTimeAsync(30000)
    expect(socket.sent).toContain('{"type":"server:ping"}')
    await vi.advanceTimersByTimeAsync(12000)
    expect(TestSocket.sockets).toHaveLength(2)
  })

  it('keeps a responsive connection and resumes immediately when the network returns', async () => {
    const socket = await connect()
    await vi.advanceTimersByTimeAsync(30000)
    await socket.receive('server:pong')
    await vi.advanceTimersByTimeAsync(10000)
    expect(TestSocket.sockets).toHaveLength(1)
    socket.close()
    await nextTick()
    window.dispatchEvent(new Event('online'))
    expect(TestSocket.sockets).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(TestSocket.sockets).toHaveLength(2)
  })

  it('retries consecutive login failures, and stops on invalid authorization', async () => {
    const socket = await connect()
    await socket.receive(CoreEventType.AuthError)
    await vi.advanceTimersByTimeAsync(2000)
    expect(socket.logins()).toHaveLength(2)
    await socket.receive(CoreEventType.AuthError)
    await vi.advanceTimersByTimeAsync(4000)
    expect(socket.logins()).toHaveLength(3)
    await socket.receive(CoreEventType.AuthError)
    await socket.receive(CoreEventType.AuthDisconnected)
    await vi.advanceTimersByTimeAsync(30000)
    expect(socket.logins()).toHaveLength(3)
  })

  it('does not retry a removed account or keep retry timers after disposal', async () => {
    const socket = await connect()
    await socket.receive(CoreEventType.AuthError)
    useAccountStore().handleAuth().logout()
    await nextTick()
    await vi.advanceTimersByTimeAsync(10000)
    expect(socket.logins()).toHaveLength(1)
    disposePinia(pinia)
    const count = TestSocket.sockets.length
    await vi.advanceTimersByTimeAsync(30000)
    expect(TestSocket.sockets).toHaveLength(count)
  })

  it('opens only one socket for the new account and ignores late messages from the old socket', async () => {
    const first = await connect()
    await first.receive(CoreEventType.AuthError)
    useAccountStore().handleAuth().addNewAccount()
    await nextTick()
    expect(TestSocket.sockets).toHaveLength(2)
    const second = await connect()
    await first.receive(CoreEventType.SessionUpdate, { session: 'old-account-session' })
    await vi.advanceTimersByTimeAsync(10000)
    expect(second.logins()).toHaveLength(0)
    expect(useSessionStore().activeSession?.session).toBeUndefined()
  })

  it('does not replay actions queued during an outage into the next connection', async () => {
    const socket = await connect()
    socket.close()
    await nextTick()
    expect(() => useWebsocketAdapter().sendEvent(CoreEventType.AuthLogout))
      .toThrow('WebSocket is not connected')
    await vi.advanceTimersByTimeAsync(2000)
    const recovered = await connect()
    expect(recovered.sent.some(data => JSON.parse(data).type === CoreEventType.AuthLogout)).toBe(false)
  })

  it('removes the local session even when logout cannot reach the server', async () => {
    const socket = await connect()
    socket.close()
    await nextTick()
    expect(() => useAccountStore().handleAuth().logout()).toThrow('WebSocket is not connected')
    expect(useSessionStore().activeSession).toBeUndefined()
    await vi.advanceTimersByTimeAsync(10000)
    expect(TestSocket.sockets).toHaveLength(1)
  })

  it('does not turn an interactive phone login error into saved-session recovery', async () => {
    const socket = await connect()
    useAccountStore().handleAuth().login('+15555550123')
    await socket.receive(CoreEventType.AuthError)
    await vi.advanceTimersByTimeAsync(30000)
    expect(socket.logins()).toHaveLength(2)
    expect(useAccountStore().auth.isLoading).toBe(false)
  })
})
