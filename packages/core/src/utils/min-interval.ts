/**
 * Create an abortable minimum-interval waiter.
 * Ensures at least `intervalMs` time passes between successive `wait` calls.
 *
 * This is intentionally tiny and dependency-free, suitable for both Node and browser.
 */
export function createMinIntervalWaiter(intervalMs: number) {
  let lastRunAt = 0

  async function wait(signal: AbortSignal): Promise<void> {
    const now = Date.now()
    const elapsed = now - lastRunAt
    const remaining = intervalMs - elapsed

    if (remaining > 0) {
      await new Promise<void>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        const onAbort = () => {
          if (timeoutId)
            clearTimeout(timeoutId)
          signal.removeEventListener('abort', onAbort)
          reject(new Error('aborted'))
        }
        if (signal.aborted) {
          return onAbort()
        }
        timeoutId = setTimeout(() => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        }, remaining)
        signal.addEventListener('abort', onAbort, { once: true })
      })
    }

    lastRunAt = Date.now()
  }

  return wait
}
