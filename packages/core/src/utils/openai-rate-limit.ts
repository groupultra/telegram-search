let lastOpenAIRequestTime = 0
const OPENAI_RATE_LIMIT_MS = 1500 // 1.5 seconds

export async function withOpenAIRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const wait = Math.max(0, lastOpenAIRequestTime + OPENAI_RATE_LIMIT_MS - now)
  if (wait > 0) {
    await new Promise(res => setTimeout(res, wait))
  }

  lastOpenAIRequestTime = Date.now()
  return fn()
}
