// @vitest-environment happy-dom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { savePendingSignIn } from '../../lib/server-auth'
import { useServerAuthStore } from '../server-auth'

const bridge = vi.hoisted(() => ({ sendEvent: vi.fn(), waitForEvent: vi.fn() }))
vi.mock('@tg-search/client', () => ({ useBridge: () => bridge }))

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  bridge.sendEvent.mockReset()
  bridge.waitForEvent.mockReset()
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

  it('signs in with a ticket from the bridge and resumes a pending authorization request', async () => {
    bridge.waitForEvent.mockResolvedValue({ ticket: 'ticket-value' })
    const fetch = vi.fn(async () => Response.json({ redirect: true, url: '/auth/consent?sig=s2' }))
    vi.stubGlobal('fetch', fetch)
    savePendingSignIn({ oauthQuery: 'client_id=c&sig=s' })

    const store = useServerAuthStore()
    expect(await store.completeSignIn()).toEqual({ kind: 'navigate', url: '/auth/consent?sig=s2' })
    expect(bridge.sendEvent).toHaveBeenCalledWith('server:sign-in-ticket')
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ ticket: 'ticket-value', oauth_query: 'client_id=c&sig=s' })
    expect(store.status).toBe('signed-in')
  })

  it('returns to the requested page and fails when the server issues no ticket', async () => {
    bridge.waitForEvent.mockResolvedValueOnce({ ticket: 'ticket-value' })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ userId: 'user-1' })))
    savePendingSignIn({ redirect: '/auth/device?user_code=ABCD' })
    const store = useServerAuthStore()
    expect(await store.completeSignIn()).toEqual({ kind: 'route', path: '/auth/device?user_code=ABCD' })

    // The server answers before the Telegram account is ready; nothing is exchanged.
    bridge.waitForEvent.mockResolvedValueOnce({ error: 'ACCOUNT_NOT_READY' })
    await expect(store.completeSignIn()).rejects.toThrow('ACCOUNT_NOT_READY')
  })
})
