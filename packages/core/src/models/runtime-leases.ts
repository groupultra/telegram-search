import type { CoreDB } from '../db'
import type { PromiseResult } from '../utils/result'

import { and, eq, lt, or } from 'drizzle-orm'

import { runtimeLeasesTable } from '../schemas/runtime-leases'
import { withResult } from '../utils/result'

/**
 * Takes or renews a lease. Succeeds when the lease is free, expired, or
 * already held by `holder`; one atomic upsert, so two instances never both win.
 */
async function acquireLease(db: CoreDB, name: string, holder: string, ttlMs: number): PromiseResult<boolean> {
  return withResult(async () => {
    const now = Date.now()
    const rows = await db
      .insert(runtimeLeasesTable)
      .values({ name, holder, expires_at: now + ttlMs })
      .onConflictDoUpdate({
        target: runtimeLeasesTable.name,
        set: { holder, expires_at: now + ttlMs },
        setWhere: or(eq(runtimeLeasesTable.holder, holder), lt(runtimeLeasesTable.expires_at, now)),
      })
      .returning()
    return rows.length > 0
  })
}

async function releaseLease(db: CoreDB, name: string, holder: string): PromiseResult<void> {
  return withResult(async () => {
    await db.delete(runtimeLeasesTable).where(and(eq(runtimeLeasesTable.name, name), eq(runtimeLeasesTable.holder, holder)))
  })
}

export const runtimeLeaseModels = {
  acquireLease,
  releaseLease,
}

export type RuntimeLeaseModels = typeof runtimeLeaseModels
