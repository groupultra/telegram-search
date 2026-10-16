export const DAEMON_RECONNECT_RECOVERY_INITIAL_DELAY_MS = 120_000
export const DAEMON_RECONNECT_RECOVERY_MAX_DELAY_MS = 15 * 60_000

export interface DaemonReconnectRecovery {
  schedule: () => void
  reset: () => void
  stop: () => void
}

export interface DaemonReconnectRecoveryOptions {
  recover: () => Promise<boolean>
  initialDelayMs?: number
  maxDelayMs?: number
}

/**
 * GramJS stops retrying after its finite connectionRetries budget. Keep the
 * daemon alive across a transient network outage without competing with that
 * first retry cycle.
 */
export function createDaemonReconnectRecovery({
  recover,
  initialDelayMs = DAEMON_RECONNECT_RECOVERY_INITIAL_DELAY_MS,
  maxDelayMs = DAEMON_RECONNECT_RECOVERY_MAX_DELAY_MS,
}: DaemonReconnectRecoveryOptions): DaemonReconnectRecovery {
  let attempt = 0
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const reset = () => {
    if (timer)
      clearTimeout(timer)
    timer = undefined
    attempt = 0
  }

  const schedule = () => {
    if (stopped || timer)
      return

    const delay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs)
    timer = setTimeout(() => {
      timer = undefined
      void recover().then((connected) => {
        if (stopped || connected)
          return
        attempt += 1
        schedule()
      }).catch(() => {
        if (stopped)
          return
        attempt += 1
        schedule()
      })
    }, delay)
  }

  return {
    schedule,
    reset,
    stop: () => {
      stopped = true
      reset()
    },
  }
}
