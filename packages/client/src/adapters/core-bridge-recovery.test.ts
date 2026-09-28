import { CoreEventType } from '@tg-search/core'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useSessionStore } from '../stores/useSession'
import { useCoreBridgeAdapter } from './core-bridge'

it('signals a new unready local runtime after switching accounts', async () => {
  vi.useFakeTimers()
  const pinia = createPinia()
  setActivePinia(pinia)
  localStorage.clear()
  const sessions = useSessionStore()
  sessions.init()
  const bridge = useCoreBridgeAdapter()
  const connected = vi.fn()
  void bridge.waitForEvent('server:connected').then(connected)
  try {
    const nextId = sessions.addNewAccount()
    await nextTick()
    await vi.advanceTimersByTimeAsync(200)
    expect(connected).toHaveBeenCalledWith({ sessionId: nextId, accountReady: false })
  }
  finally {
    bridge.sendEvent(CoreEventType.CoreCleanup)
    disposePinia(pinia)
    vi.useRealTimers()
  }
})
