import type { AccountState } from '../account'
import type { StoredTelegramSession, TelegramSessionStore } from './store'

import { EventEmitter } from 'node:events'

import { CoreEventType } from '@tg-search/core'
import { describe, expect, it, vi } from 'vitest'

import { restoreTelegramSessions } from './restore'

type LoginBehavior = 'ready' | 'revoked' | 'failed' | 'hang'

const logger = { withFields: () => ({ log: vi.fn(), withError: () => ({ warn: vi.fn() }) }) } as never

function fakeAccount(behavior: LoginBehavior, logins: string[]) {
  const emitter = new EventEmitter()
  const account = { accountReady: false, ctx: { emitter } } as unknown as AccountState
  emitter.on(CoreEventType.AuthLogin, ({ session }: { session: string }) => {
    logins.push(session)
    setTimeout(() => {
      if (behavior === 'ready') {
        account.accountReady = true
        emitter.emit(CoreEventType.AccountReady, { accountId: 'x' })
      }
      // Same order as the connection service: AuthError, then AuthDisconnected for a rejected key.
      if (behavior === 'revoked') {
        emitter.emit(CoreEventType.AuthError)
        emitter.emit(CoreEventType.AuthDisconnected)
      }
      if (behavior === 'failed')
        emitter.emit(CoreEventType.AuthError)
    }, 1)
  })
  return account
}

function fakeStore(entries: StoredTelegramSession[]) {
  return {
    save: vi.fn(),
    remove: vi.fn(async () => {}),
    loadAll: vi.fn(async () => entries),
  } satisfies TelegramSessionStore
}

const entry = (name: string): StoredTelegramSession => ({ accountId: `account-${name}`, runtimeKey: `runtime-${name}`, session: `session-${name}` })

describe('restoreTelegramSessions', () => {
  it('logs each stored session in under the runtime key its browser used', async () => {
    const logins: string[] = []
    const accounts = new Map<string, AccountState>()
    const getAccount = vi.fn((key: string) => {
      const account = fakeAccount('ready', logins)
      accounts.set(key, account)
      return account
    })
    const outcomes = await restoreTelegramSessions({ sessions: fakeStore([entry('a'), entry('b')]), getAccount, logger })

    expect(getAccount.mock.calls.map(([key]) => key)).toEqual(['runtime-a', 'runtime-b'])
    expect(logins.sort()).toEqual(['session-a', 'session-b'])
    expect([...outcomes]).toEqual(expect.arrayContaining([['account-a', 'ready'], ['account-b', 'ready']]))
    expect(accounts.get('runtime-a')?.accountReady).toBe(true)
  })

  it('deletes only sessions that Telegram rejected', async () => {
    const behaviors: Record<string, LoginBehavior> = { 'runtime-revoked': 'revoked', 'runtime-failed': 'failed', 'runtime-hang': 'hang' }
    const store = fakeStore([entry('revoked'), entry('failed'), entry('hang')])
    const outcomes = await restoreTelegramSessions({ sessions: store, getAccount: key => fakeAccount(behaviors[key], []), logger, timeoutMs: 20 })

    expect(Object.fromEntries(outcomes)).toEqual({ 'account-revoked': 'revoked', 'account-failed': 'failed', 'account-hang': 'timeout' })
    // A network failure or a slow login keeps the row for the next start.
    expect(store.remove).toHaveBeenCalledExactlyOnceWith('account-revoked')
  })

  it('does not log in again when a browser already reattached the runtime', async () => {
    const logins: string[] = []
    const account = fakeAccount('ready', logins)
    account.accountReady = true
    const outcomes = await restoreTelegramSessions({ sessions: fakeStore([entry('a')]), getAccount: () => account, logger })
    expect(logins).toEqual([])
    expect(outcomes.get('account-a')).toBe('ready')
  })

  it('starts no login once shutdown began', async () => {
    // A login started after the lease is released would race the next instance for the same Telegram key.
    const logins: string[] = []
    let stopping = false
    const getAccount = () => {
      stopping = true
      return fakeAccount('ready', logins)
    }
    await restoreTelegramSessions({ sessions: fakeStore([entry('a'), entry('b')]), getAccount, logger, concurrency: 1, isStopping: () => stopping })
    expect(logins).toEqual(['session-a'])
  })

  it('runs at most `concurrency` logins at once', async () => {
    let active = 0
    let peak = 0
    const getAccount = () => {
      const emitter = new EventEmitter()
      emitter.on(CoreEventType.AuthLogin, () => {
        peak = Math.max(peak, ++active)
        setTimeout(() => {
          active--
          emitter.emit(CoreEventType.AccountReady, { accountId: 'x' })
        }, 5)
      })
      return { accountReady: false, ctx: { emitter } } as unknown as AccountState
    }
    await restoreTelegramSessions({ sessions: fakeStore(['a', 'b', 'c', 'd', 'e'].map(entry)), getAccount, logger, concurrency: 2 })
    expect(peak).toBe(2)
  })
})
