import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMinIntervalWaiter } from '../min-interval'

describe('min-interval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('createMinIntervalWaiter', () => {
    it('should not wait if enough time has passed', async () => {
      const wait = createMinIntervalWaiter(100)
      const signal = new AbortController().signal

      // First call should not wait
      const promise = wait(signal)
      await vi.advanceTimersByTimeAsync(0)
      await expect(promise).resolves.toBeUndefined()

      // Advance time beyond interval
      vi.advanceTimersByTime(200)

      // Second call should not wait
      const promise2 = wait(signal)
      await vi.advanceTimersByTimeAsync(0)
      await expect(promise2).resolves.toBeUndefined()
    })

    it('should wait for remaining time if called too soon', async () => {
      const wait = createMinIntervalWaiter(100)
      const signal = new AbortController().signal

      // First call
      await wait(signal)
      await vi.advanceTimersByTimeAsync(0)

      // Advance time by 40ms
      vi.advanceTimersByTime(40)

      // Second call should wait for 60ms more
      const promise = wait(signal)

      // Should not resolve immediately
      let resolved = false
      promise.then(() => {
        resolved = true
      })

      await vi.advanceTimersByTimeAsync(50)
      expect(resolved).toBe(false)

      // Should resolve after remaining time
      await vi.advanceTimersByTimeAsync(15)
      expect(resolved).toBe(true)
    })

    it('should reject when aborted during wait', async () => {
      const wait = createMinIntervalWaiter(100)
      const controller = new AbortController()

      // First call
      await wait(controller.signal)
      await vi.advanceTimersByTimeAsync(0)

      // Advance time by 40ms
      vi.advanceTimersByTime(40)

      // Second call should wait - capture the promise immediately
      const promise = wait(controller.signal).catch((err) => {
        expect(err.message).toBe('aborted')
        return 'caught'
      })

      // Abort after 30ms
      setTimeout(() => controller.abort(), 30)
      await vi.advanceTimersByTimeAsync(30)

      // Await the promise that already has a catch handler
      const result = await promise
      expect(result).toBe('caught')
    })

    it('should reject immediately if signal is already aborted', async () => {
      const wait = createMinIntervalWaiter(100)
      const controller = new AbortController()

      // First call
      await wait(controller.signal)
      await vi.advanceTimersByTimeAsync(0)

      // Abort before second call
      controller.abort()

      // Advance time by 40ms
      vi.advanceTimersByTime(40)

      // Second call should reject immediately
      await expect(wait(controller.signal)).rejects.toThrow('aborted')
    })

    it('should handle multiple consecutive calls correctly', async () => {
      const wait = createMinIntervalWaiter(100)
      const signal = new AbortController().signal

      // First call
      await wait(signal)
      await vi.advanceTimersByTimeAsync(0)

      // Advance 30ms and call again
      vi.advanceTimersByTime(30)
      const promise1 = wait(signal)
      await vi.advanceTimersByTimeAsync(70)
      await promise1

      // Advance 50ms and call again
      vi.advanceTimersByTime(50)
      const promise2 = wait(signal)
      await vi.advanceTimersByTimeAsync(50)
      await promise2

      expect(true).toBe(true) // All calls completed successfully
    })

    it('should calculate remaining time based on last run', async () => {
      const intervalMs = 200
      const wait = createMinIntervalWaiter(intervalMs)
      const signal = new AbortController().signal

      await wait(signal)
      await vi.advanceTimersByTimeAsync(0)

      // Advance 80ms
      vi.advanceTimersByTime(80)

      // Should wait 120ms more
      const promise = wait(signal)
      await vi.advanceTimersByTimeAsync(119)

      let resolved = false
      promise.then(() => {
        resolved = true
      })

      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync(2)
      expect(resolved).toBe(true)
    })

    it('should cleanup timeout on abort', async () => {
      const wait = createMinIntervalWaiter(100)
      const controller = new AbortController()

      await wait(controller.signal)
      await vi.advanceTimersByTimeAsync(0)

      vi.advanceTimersByTime(40)

      const promise = wait(controller.signal)

      // Abort immediately
      controller.abort()

      await expect(promise).rejects.toThrow('aborted')

      // Verify no timers are left running
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
