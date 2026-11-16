// @vitest-environment happy-dom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useServerAuthStore } from '../server-auth'

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('server sign-in store', () => {
  it('asks the server once and reuses the answer for every navigation', async () => {
    const fetch = vi.fn(async () => Response.json(null))
    vi.stubGlobal('fetch', fetch)
    const store = useServerAuthStore()
    const [first, second] = await Promise.all([store.check(), store.check()])
    expect([first, second, await store.check()]).toEqual(['signed-out', 'signed-out', 'signed-out'])
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not block the UI when the server cannot be reached', async () => {
    // The WebSocket bridge already reports an unreachable server; a sign-in redirect would hide that error.
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))
    expect(await useServerAuthStore().check()).toBe('disabled')
  })
})
