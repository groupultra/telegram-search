import { describe, expect, it, vi } from 'vitest'

import { sleep, toRetriable } from '../retry'

describe('retry', () => {
  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now()
      await sleep(100)
      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(95) // Allow small variance
      expect(duration).toBeLessThan(150)
    })
  })

  describe('toRetriable', () => {
    it('should succeed on first attempt', async () => {
      const mockFunc = vi.fn().mockResolvedValue('success')
      const retriable = toRetriable(3, 10, mockFunc)

      const result = await retriable('test')
      expect(result).toBe('success')
      expect(mockFunc).toHaveBeenCalledTimes(1)
      expect(mockFunc).toHaveBeenCalledWith('test')
    })

    it('should retry on failure and eventually succeed', async () => {
      const mockFunc = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success')

      const retriable = toRetriable(3, 10, mockFunc)

      const result = await retriable('test')
      expect(result).toBe('success')
      expect(mockFunc).toHaveBeenCalledTimes(3)
    })

    it('should throw error after exceeding retry limit', async () => {
      const mockFunc = vi.fn().mockRejectedValue(new Error('Persistent failure'))
      const retriable = toRetriable(2, 10, mockFunc)

      await expect(retriable('test')).rejects.toThrow('Persistent failure')
      expect(mockFunc).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should call onError hook on failure', async () => {
      const onError = vi.fn()
      const mockFunc = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')

      const retriable = toRetriable(3, 10, mockFunc, { onError })

      await retriable('test')
      // onError is called once for the first failure
      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(new Error('First failure'))
    })

    it('should wait delayInterval between retries', async () => {
      const mockFunc = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')

      const delayMs = 50
      const retriable = toRetriable(2, delayMs, mockFunc)

      const start = Date.now()
      await retriable('test')
      const duration = Date.now() - start

      // Should wait at least the delay interval once
      expect(duration).toBeGreaterThanOrEqual(45)
      expect(mockFunc).toHaveBeenCalledTimes(2)
    })

    it('should handle non-Error objects being thrown', async () => {
      const mockFunc = vi.fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValueOnce('success')

      const onError = vi.fn()
      const retriable = toRetriable(2, 10, mockFunc, { onError })

      const result = await retriable('test')
      expect(result).toBe('success')
      expect(onError).toHaveBeenCalledWith('string error')
    })

    it('should throw error when all retries are exhausted', async () => {
      const mockFunc = vi.fn().mockRejectedValue(new Error('Always fails'))
      const retriable = toRetriable(1, 10, mockFunc)

      await expect(retriable('test')).rejects.toThrow('Always fails')
      expect(mockFunc).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })

    it('should pass arguments correctly through retries', async () => {
      const mockFunc = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success')

      const retriable = toRetriable(2, 10, mockFunc)

      await retriable('test-arg')
      expect(mockFunc).toHaveBeenNthCalledWith(1, 'test-arg')
      expect(mockFunc).toHaveBeenNthCalledWith(2, 'test-arg')
    })
  })
})
