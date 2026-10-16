import type { AppResult, DaemonHealth } from '@tg-search/protocol'

/** Record observed facts independently; a transport event is not a read probe. */
export function createDaemonDiagnostics(now: () => number = Date.now) {
  const startedAt = now()
  const health: DaemonHealth = {
    transport: { state: 'starting', changedAt: startedAt },
    authorization: { state: 'unknown', changedAt: startedAt },
    catchUp: { state: 'unknown', changedAt: startedAt },
    reads: { telegram: { state: 'unknown', changedAt: startedAt }, local: { state: 'unknown', changedAt: startedAt } },
    recovery: { attempts: 0, inProgress: false },
  }
  const transition = <State extends string>(target: { state: State, changedAt: number, lastSuccessAt?: number }, state: State, success: boolean) => {
    if (target.state !== state)
      target.changedAt = now()
    target.state = state
    if (success)
      target.lastSuccessAt = now()
  }
  return {
    snapshot: (): DaemonHealth => structuredClone(health),
    transport: (state: DaemonHealth['transport']['state']) => transition(health.transport, state, state === 'connected'),
    authorization: (state: DaemonHealth['authorization']['state']) => transition(health.authorization, state, state === 'authorized'),
    catchUp: (state: DaemonHealth['catchUp']['state'], error?: string) => {
      transition(health.catchUp, state, state === 'idle')
      health.catchUp.error = error
    },
    read: <T>(source: 'local' | 'telegram', result: AppResult<T>) => {
      const target = health.reads[source]
      transition(target, result.ok ? 'available' : 'failed', result.ok)
      if (!result.ok) {
        target.lastFailureAt = now()
        target.errorCode = result.error.code
      }
      else {
        target.errorCode = undefined
      }
    },
    recoveryStarted: () => {
      health.recovery.attempts++
      health.recovery.inProgress = true
      health.recovery.lastAttemptAt = now()
    },
    recoveryFinished: (success: boolean) => {
      health.recovery.inProgress = false
      if (success)
        health.recovery.lastSuccessAt = now()
    },
  }
}
