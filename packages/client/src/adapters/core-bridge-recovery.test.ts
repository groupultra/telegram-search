import type { CoreContext } from '@tg-search/core'

import { generateDefaultConfig } from '@tg-search/common'
import { CoreEventType, createCoreInstance } from '@tg-search/core'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { useAccountStore } from '../stores/useAccount'
import { useSessionStore } from '../stores/useSession'
import { createCoreBridgeAdapter, useCoreBridgeAdapter } from './core-bridge'

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  vi.useFakeTimers()
  pinia = createPinia()
  setActivePinia(pinia)
  localStorage.clear()
  useSessionStore().init()
})

afterEach(async () => {
  disposePinia(pinia)
  await vi.advanceTimersByTimeAsync(500)
  vi.useRealTimers()
})

it('signals a new unready local runtime after switching accounts', async () => {
  const sessions = useSessionStore()
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
  }
})

function createDelayedRuntime() {
  let current: CoreContext | undefined
  const contexts: CoreContext[] = []
  let activeDestructions = 0
  let maxDestructions = 0
  const scope = effectScope()
  const bridge = scope.run(() => createCoreBridgeAdapter(() => ({
    getCtx() {
      if (!current) {
        current = createCoreInstance(() => {
          throw new Error('Database is not used in this test')
        }, generateDefaultConfig(), undefined)
        contexts.push(current)
      }
      return current
    },
    async destroy() {
      if (!current)
        return
      activeDestructions++
      maxDestructions = Math.max(maxDestructions, activeDestructions)
      await new Promise(resolve => setTimeout(resolve, 100))
      current.cleanup()
      current = undefined
      activeDestructions--
    },
  })))!
  bridge.sendEvent('server:event:register', { event: CoreEventType.AuthDisconnected })
  return { bridge, scope, contexts, maxDestructions: () => maxDestructions }
}

it('ignores late logout events from the previous local account', async () => {
  const { bridge, scope, contexts } = createDelayedRuntime()
  const account = useAccountStore()
  const oldContext = contexts[0]
  useSessionStore().addNewAccount()
  account.isReady = true
  oldContext.emitter.emit(CoreEventType.AuthDisconnected)
  expect(account.isReady).toBe(true)
  await vi.advanceTimersByTimeAsync(200)
  account.isReady = true
  contexts.at(-1)!.emitter.emit(CoreEventType.AuthDisconnected)
  expect(account.isReady).toBe(false)
  bridge.sendEvent(CoreEventType.CoreCleanup)
  scope.stop()
})

it('serializes rapid account changes and only announces the last runtime', async () => {
  const { bridge, scope, contexts, maxDestructions } = createDelayedRuntime()
  const connected = vi.fn()
  void bridge.waitForEvent('server:connected').then(connected)
  useSessionStore().addNewAccount()
  await vi.advanceTimersByTimeAsync(50)
  const lastId = useSessionStore().addNewAccount()
  await vi.advanceTimersByTimeAsync(300)
  expect(maxDestructions()).toBe(1)
  expect(contexts).toHaveLength(2)
  expect(connected).toHaveBeenCalledOnce()
  expect(connected).toHaveBeenCalledWith({ sessionId: lastId, accountReady: false })
  scope.stop()
})

it('does not create a replacement local runtime after disposal', async () => {
  const { scope, contexts } = createDelayedRuntime()
  useSessionStore().addNewAccount()
  await vi.advanceTimersByTimeAsync(50)
  scope.stop()
  await vi.advanceTimersByTimeAsync(300)
  expect(contexts).toHaveLength(1)
})
