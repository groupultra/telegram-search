import type { CoreDB } from '@tg-search/core'

import { models, runtimeLeasesTable } from '@tg-search/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockDB } from '../../../../packages/core/src/db/mock'
import { createRuntimeLease } from './lease'

const logger = { log: vi.fn(), error: vi.fn(), withFields: () => ({ log: vi.fn(), error: vi.fn() }), withError: () => ({ warn: vi.fn() }) } as never

describe('runtime lease', () => {
  let db: CoreDB

  beforeEach(async () => {
    db = await mockDB({ runtimeLeasesTable })
  })

  it('lets only one holder win and renew', async () => {
    const { acquireLease } = models.runtimeLeaseModels
    const results = await Promise.all([acquireLease(db, 'lease', 'a', 10_000), acquireLease(db, 'lease', 'b', 10_000)])
    expect(results.map(result => result.expect('acquire')).sort()).toEqual([false, true])
    const winner = (await db.select().from(runtimeLeasesTable))[0].holder
    expect((await acquireLease(db, 'lease', winner, 10_000)).expect('renew')).toBe(true)
  })

  it('hands an expired lease to another holder', async () => {
    // A crashed instance stops renewing; the next one must not wait forever.
    const { acquireLease } = models.runtimeLeaseModels
    expect((await acquireLease(db, 'lease', 'crashed', -1)).expect('acquire')).toBe(true)
    expect((await acquireLease(db, 'lease', 'next', 10_000)).expect('acquire')).toBe(true)
  })

  it('waits for the previous instance to release before restoring', async () => {
    // Restoring while the old instance still holds the clients would use the same Telegram key twice (AUTH_KEY_DUPLICATED).
    const previous = createRuntimeLease({ db, logger, pollMs: 5 })
    expect(await previous.acquire()).toBe(true)

    const next = createRuntimeLease({ db, logger, pollMs: 5 })
    let acquired = false
    const pending = next.acquire().then((value) => {
      acquired = value
    })
    await new Promise(resolve => setTimeout(resolve, 40))
    expect(acquired).toBe(false)

    await previous.release()
    await pending
    expect(acquired).toBe(true)
    expect((await db.select().from(runtimeLeasesTable))[0].holder).toBe(next.holder)
    await next.release()
  })

  it('stops waiting when released during shutdown', async () => {
    const holder = createRuntimeLease({ db, logger, pollMs: 5 })
    await holder.acquire()
    const waiting = createRuntimeLease({ db, logger, pollMs: 5 })
    const pending = waiting.acquire()
    await waiting.release()
    expect(await pending).toBe(false)
    // Releasing a lease it never held leaves the holder's row alone.
    expect((await db.select().from(runtimeLeasesTable))[0].holder).toBe(holder.holder)
    await holder.release()
  })
})
