// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { decideDeviceAuthorization, getDeviceAuthorization, getServerAuthStatus, isServerAuthRoute, safeRedirectPath, ServerAuthError, startTelegramSignIn, submitConsent } from '../server-auth'

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string, init: RequestInit }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init })
    return handler(url, init)
  }))
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('server sign-in state', () => {
  it('distinguishes a server without OAuth from a signed-out and a signed-in one', async () => {
    // TGS_AUTH=none has no auth routes, so the session endpoint answers 404 and the bridge must start as before.
    mockFetch(() => new Response('not found', { status: 404 }))
    expect(await getServerAuthStatus()).toBe('disabled')

    mockFetch(() => Response.json(null))
    expect(await getServerAuthStatus()).toBe('signed-out')

    const calls = mockFetch(() => Response.json({ user: { id: 'user-1' }, session: {} }))
    expect(await getServerAuthStatus()).toBe('signed-in')
    expect(calls[0]).toMatchObject({ url: '/api/auth/get-session', init: { credentials: 'same-origin' } })
  })

  it('reports other server failures instead of treating them as disabled', async () => {
    mockFetch(() => Response.json({ code: 'INTERNAL', message: 'boom' }, { status: 500 }))
    await expect(getServerAuthStatus()).rejects.toBeInstanceOf(ServerAuthError)
  })
})

describe('redirect handling', () => {
  it.each([
    ['/sync', '/sync'],
    ['/chat/1?x=1', '/chat/1?x=1'],
    ['//evil.example/path', '/'],
    ['/\\evil.example', '/'],
    ['https://evil.example', '/'],
    [undefined, '/'],
  ])('keeps only same-origin paths: %s', (value, expected) => {
    expect(safeRedirectPath(value)).toBe(expected)
  })

  it('matches only the OAuth pages as public routes', () => {
    expect(isServerAuthRoute('/auth/sign-in')).toBe(true)
    expect(isServerAuthRoute('/auth/device')).toBe(true)
    expect(isServerAuthRoute('/authors')).toBe(false)
    expect(isServerAuthRoute('/login')).toBe(false)
  })
})

describe('authorization calls', () => {
  it('starts Telegram sign-in with a safe callback and resumes a signed authorization request', async () => {
    const calls = mockFetch(() => Response.json({ url: 'https://oauth.telegram.org/auth?state=s', redirect: true }))
    expect(await startTelegramSignIn({ callbackPath: '//evil.example' })).toBe('https://oauth.telegram.org/auth?state=s')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ provider: 'telegram', callbackURL: '/', errorCallbackURL: '/auth/sign-in' })

    await startTelegramSignIn({ callbackPath: '/', oauthQuery: 'client_id=c&sig=s' })
    expect(JSON.parse(calls[1].init.body as string)).toMatchObject({ oauth_query: 'client_id=c&sig=s' })
  })

  it('submits consent with the signed query and returns the client redirect', async () => {
    const calls = mockFetch(() => Response.json({ redirect: true, url: 'https://client.example/callback?code=c' }))
    expect(await submitConsent({ accept: true, oauthQuery: 'client_id=c&sig=s' })).toBe('https://client.example/callback?code=c')
    expect(calls[0].url).toBe('/api/auth/oauth2/consent')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ accept: true, oauth_query: 'client_id=c&sig=s' })
  })

  it('normalizes device codes and maps the requested scopes', async () => {
    const calls = mockFetch(url => url.startsWith('/api/auth/device?')
      ? Response.json({ user_code: 'ABCDEFGH', status: 'pending', client_id: 'tgs-cli', scope: 'messages:read offline_access' })
      : Response.json({ success: true }))
    expect(await getDeviceAuthorization(' abcd-efgh ')).toEqual({ userCode: 'ABCDEFGH', status: 'pending', clientId: 'tgs-cli', scopes: ['messages:read', 'offline_access'] })
    expect(calls[0].url).toBe('/api/auth/device?user_code=ABCDEFGH')

    await decideDeviceAuthorization('abcd-efgh', false)
    expect(calls[1]).toMatchObject({ url: '/api/auth/device/deny' })
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ userCode: 'ABCDEFGH' })
  })

  it('surfaces the status of a rejected call so pages can send the user to sign in', async () => {
    mockFetch(() => Response.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 }))
    await expect(getDeviceAuthorization('ABCDEFGH')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
  })
})
