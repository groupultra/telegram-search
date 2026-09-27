import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDaemonReconnectRecovery } from './reconnect-recovery'

afterEach(() => {
  vi.useRealTimers()
})

describe('daemon reconnect recovery', () => {
  it('retries with exponential backoff after GramJS exhausts its finite connection retries', async () => {
    // GramJS leaves the client disconnected after connectionRetries is exhausted.
    vi.useFakeTimers()
    const recover = vi.fn().mockResolvedValue(false)
    const recovery = createDaemonReconnectRecovery({
      recover,
      initialDelayMs: 10,
      maxDelayMs: 40,
    })

    recovery.schedule()
    recovery.schedule()

    await vi.advanceTimersByTimeAsync(10)
    expect(recover).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(20)
    expect(recover).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(40)
    expect(recover).toHaveBeenCalledTimes(3)
  })

  it('cancels the pending recovery after the transport reconnects', async () => {
    vi.useFakeTimers()
    const recover = vi.fn().mockResolvedValue(true)
    const recovery = createDaemonReconnectRecovery({ recover, initialDelayMs: 10 })

    recovery.schedule()
    recovery.reset()

    await vi.advanceTimersByTimeAsync(10)
    expect(recover).not.toHaveBeenCalled()
  })

  it('does not schedule another attempt after the daemon stops', async () => {
    vi.useFakeTimers()
    const recover = vi.fn().mockResolvedValue(false)
    const recovery = createDaemonReconnectRecovery({ recover, initialDelayMs: 10 })

    recovery.schedule()
    recovery.stop()

    await vi.advanceTimersByTimeAsync(10)
    expect(recover).not.toHaveBeenCalled()
  })
})
