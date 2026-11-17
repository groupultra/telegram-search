import { CoreEventType } from '@tg-search/core'
import { describe, expect, it, vi } from 'vitest'

import { storeAccountSession } from '../account'
import { updateAccountState } from '../app'

vi.mock('@tg-search/core', async original => ({ ...await original<typeof import('@tg-search/core')>(), destroyCoreInstance: vi.fn(async () => {}) }))

const logger = { withFields: () => ({ log: vi.fn(), warn: vi.fn(), withError: () => ({ warn: vi.fn(), error: vi.fn() }) }) } as never

function sessions() {
  return { save: vi.fn(async () => {}), remove: vi.fn(async () => {}), loadAll: vi.fn(async () => []) }
}

describe('stored Telegram session lifecycle', () => {
  it('stores the ready account session under the database account and the runtime key', async () => {
    const store = sessions()
    const account = { ctx: { getClient: () => ({ session: { save: () => 'session-string' } }) } } as never
    await storeAccountSession(account, store, 'runtime-key', 'db-account', logger)
    expect(store.save).toHaveBeenCalledWith({ accountId: 'db-account', runtimeKey: 'runtime-key', session: 'session-string' })
  })

  it('does not fail the login when storing fails', async () => {
    const store = sessions()
    store.save.mockRejectedValueOnce(new Error('database unavailable'))
    const account = { ctx: { getClient: () => ({ session: { save: () => 'session-string' } }) } } as never
    await expect(storeAccountSession(account, store, 'runtime-key', 'db-account', logger)).resolves.toBeUndefined()
  })

  it('deletes the stored session on logout', async () => {
    // Without this, a logged-out account would reconnect on the next restart.
    const store = sessions()
    const account = { accountReady: true, sessions: store, activePeers: new Set(), ctx: { getCurrentAccountId: () => 'db-account' } } as never
    await updateAccountState(logger, account, 'runtime-key', CoreEventType.AuthLogout)
    expect(store.remove).toHaveBeenCalledWith('db-account')
  })

  it('has nothing to delete when logging out before the account was ready', async () => {
    const store = sessions()
    const getCurrentAccountId = () => {
      throw new Error('Current account ID not set')
    }
    const account = { accountReady: false, sessions: store, activePeers: new Set(), ctx: { getCurrentAccountId } } as never
    await updateAccountState(logger, account, 'runtime-key', CoreEventType.AuthLogout)
    expect(store.remove).not.toHaveBeenCalled()
  })
})
