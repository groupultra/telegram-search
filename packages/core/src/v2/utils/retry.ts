export function withRetry<T>(fn: () => Promise<T>, options: {
  maxRetries?: number
  initialDelay?: number
} = {}): Promise<T> {
  const maxRetries = options.maxRetries || 3
  const initialDelay = options.initialDelay || 2000

  let retries = 0

  function attempt(): Promise<T> {
    return fn().catch((error) => {
      if (retries >= maxRetries) {
        throw error
      }

      const delay = initialDelay * 2 ** retries
      const jitter = Math.random() * 200

      retries++
      return new Promise(resolve =>
        setTimeout(() => resolve(attempt()), delay + jitter),
      )
    })
  }

  return attempt()
}
