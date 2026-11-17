import type { Logger } from '@guiiai/logg'
import type { CoreDB } from '@tg-search/core'

import { randomUUID } from 'node:crypto'

import { models } from '@tg-search/core'

/**
 * One server instance at a time may hold the restored Telegram clients.
 *
 * NOTICE: Telegram invalidates an authorization key that sends requests over
 * two TCP connections at once (AUTH_KEY_DUPLICATED, https://core.telegram.org/api/errors).
 * A deployment can run the old and the new instance side by side (Railway's
 * overlap), so the new instance must not restore sessions while the old one
 * still holds them. The old instance releases the lease after disconnecting
 * its clients on SIGTERM; a crashed one stops renewing and the lease expires.
 */
export const TELEGRAM_RUNTIME_LEASE = 'telegram-runtime'

export interface RuntimeLeaseOptions {
  db: CoreDB
  logger: Logger
  name?: string
  ttlMs?: number
  renewMs?: number
  pollMs?: number
}

export function createRuntimeLease(options: RuntimeLeaseOptions) {
  const { db, logger } = options
  const name = options.name ?? TELEGRAM_RUNTIME_LEASE
  const ttlMs = options.ttlMs ?? 30_000
  const renewMs = options.renewMs ?? 10_000
  const pollMs = options.pollMs ?? 2_000
  const holder = randomUUID()
  const leases = models.runtimeLeaseModels
  let renewTimer: ReturnType<typeof setInterval> | undefined
  let released = false

  const tryAcquire = async () => (await leases.acquireLease(db, name, holder, ttlMs)).expect('Failed to acquire the runtime lease')

  return {
    holder,

    /** Resolves once this instance holds the lease, then keeps renewing it; resolves false if released first. */
    async acquire(): Promise<boolean> {
      let waiting = false
      for (;;) {
        // `release()` during shutdown ends the wait.
        if (released)
          return false
        try {
          if (await tryAcquire())
            break
        }
        catch (error) {
          logger.withError(error).warn('Runtime lease check failed; retrying')
        }
        if (!waiting) {
          waiting = true
          logger.withFields({ lease: name }).log('Another instance holds the Telegram runtime; waiting before restoring sessions')
        }
        await new Promise(resolve => setTimeout(resolve, pollMs))
      }
      if (released) {
        // Released while the acquiring query ran: give the row back.
        await leases.releaseLease(db, name, holder)
        return false
      }

      renewTimer = setInterval(() => {
        tryAcquire().then((renewed) => {
          if (!renewed)
            logger.withFields({ lease: name }).error('Lost the Telegram runtime lease to another instance')
        }).catch(error => logger.withError(error).warn('Failed to renew the runtime lease'))
      }, renewMs)
      renewTimer.unref?.()
      return true
    },

    /** Stops renewing and frees the lease for the next instance. Call only after this instance's clients are disconnected. */
    async release(): Promise<void> {
      released = true
      clearInterval(renewTimer)
      ;(await leases.releaseLease(db, name, holder)).expect('Failed to release the runtime lease')
    },
  }
}

export type RuntimeLease = ReturnType<typeof createRuntimeLease>
