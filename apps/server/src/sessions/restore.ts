import type { Logger } from '@guiiai/logg'

import type { AccountState } from '../account'
import type { StoredTelegramSession, TelegramSessionStore } from './store'

import { CoreEventType } from '@tg-search/core'

export type RestoreOutcome = 'ready' | 'revoked' | 'failed' | 'timeout'

export interface RestoreOptions {
  sessions: TelegramSessionStore
  /** Returns the account runtime for a runtime key, creating it if needed (`getOrCreateAccount`). */
  getAccount: (runtimeKey: string) => AccountState
  logger: Logger
  /** Logins run in parallel up to this many; each one also fetches dialogs before it is ready. */
  concurrency?: number
  timeoutMs?: number
  /** Checked before each login; shutdown sets it so no login starts after the lease is released. */
  isStopping?: () => boolean
}

/**
 * Reconnects every stored Telegram session after a server start. Each
 * session gets the runtime key its browser used, so the Web UI reattaches to
 * the restored runtime instead of opening a second client with the same
 * authorization key. Failures are logged; a restart never blocks on Telegram.
 */
export async function restoreTelegramSessions(options: RestoreOptions): Promise<Map<string, RestoreOutcome>> {
  const { sessions, getAccount, logger } = options
  const concurrency = options.concurrency ?? 4
  const timeoutMs = options.timeoutMs ?? 120_000
  const stored = await sessions.loadAll()
  const outcomes = new Map<string, RestoreOutcome>()

  async function restore(entry: StoredTelegramSession) {
    const fields = { accountId: entry.accountId }
    const account = getAccount(entry.runtimeKey)
    const outcome = account.accountReady ? 'ready' : await login(account, entry.session, timeoutMs)
    outcomes.set(entry.accountId, outcome)
    if (outcome === 'revoked') {
      // Telegram rejected the authorization key (logged out elsewhere, or AUTH_KEY_DUPLICATED); it can never work again.
      await sessions.remove(entry.accountId).catch(error => logger.withFields(fields).withError(error).warn('Failed to delete a revoked Telegram session'))
    }
    logger.withFields({ ...fields, outcome }).log('Restored Telegram session')
  }

  const queue = [...stored]
  async function worker() {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      if (options.isStopping?.())
        return
      try {
        await restore(entry)
      }
      catch (error) {
        outcomes.set(entry.accountId, 'failed')
        logger.withFields({ accountId: entry.accountId }).withError(error).warn('Failed to restore a Telegram session')
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  return outcomes
}

function login(account: AccountState, session: string, timeoutMs: number): Promise<RestoreOutcome> {
  const { emitter } = account.ctx
  return new Promise((resolve) => {
    const cleanups: Array<() => void> = []
    let settled = false
    const finish = (outcome: RestoreOutcome) => {
      if (settled)
        return
      settled = true
      cleanups.forEach(cleanup => cleanup())
      resolve(outcome)
    }
    const listen = (event: CoreEventType.AccountReady | CoreEventType.AuthDisconnected | CoreEventType.AuthError, listener: () => void) => {
      emitter.on(event, listener)
      cleanups.push(() => emitter.off(event, listener))
    }

    listen(CoreEventType.AccountReady, () => finish('ready'))
    listen(CoreEventType.AuthDisconnected, () => finish('revoked'))
    // The connection service emits AuthError first and then, for a rejected key, AuthDisconnected in the same tick.
    listen(CoreEventType.AuthError, () => setImmediate(() => finish('failed')))
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    cleanups.push(() => clearTimeout(timer))

    emitter.emit(CoreEventType.AuthLogin, { session })
  })
}
