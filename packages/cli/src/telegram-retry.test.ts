import type { AppResult } from '@tg-search/protocol'

import { retryTelegramOperation, retryTelegramResult } from '@tg-search/core'
import { describe, expect, it, vi } from 'vitest'

import { CLI_TELEGRAM_CLIENT_OPTIONS } from './telegram-client-options'

describe('telegram CLI retry policy', () => {
  it('allows one post-migration request retry without enabling unbounded waits', () => {
    expect(CLI_TELEGRAM_CLIENT_OPTIONS).toMatchObject({
      floodSleepThreshold: 0,
      requestRetries: 2,
    })
  })

  it('retries transient failures with bounded exponential backoff', async () => {
    const results: AppResult<string>[] = [
      { ok: false, error: { code: 'TELEGRAM_TRANSIENT', message: 'temporary', retryable: true } },
      { ok: false, error: { code: 'TELEGRAM_TRANSIENT', message: 'temporary', retryable: true } },
      { ok: true, data: 'done' },
    ]
    const operation = vi.fn(async () => results.shift()!)
    const delays: number[] = []

    const result = await retryTelegramResult(operation, {
      jitterRatio: 0,
      sleep: async delay => void delays.push(delay),
    })

    expect(result).toEqual({ ok: true, data: 'done' })
    expect(operation).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([500, 1000])
  })

  it('does not retry deterministic request errors', async () => {
    const operation = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'TELEGRAM_RPC_ERROR', message: 'PHONE_NUMBER_INVALID', retryable: false },
    }))

    await retryTelegramResult(operation)

    expect(operation).toHaveBeenCalledOnce()
  })

  it('returns server-directed waits to the caller instead of sleeping', async () => {
    const waitError = {
      ok: false as const,
      error: {
        code: 'TELEGRAM_FLOOD_WAIT',
        message: 'wait',
        retryable: true,
        retryAfterSeconds: 298,
      },
    }
    const operation = vi.fn(async () => waitError)
    const wait = vi.fn(async () => {})

    const result = await retryTelegramResult(operation, { sleep: wait })

    expect(result).toEqual(waitError)
    expect(operation).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })

  it('returns Takeout authorization requirements to the Agent without retrying', async () => {
    const authorizationRequired = {
      ok: false as const,
      error: {
        code: 'TAKEOUT_AUTHORIZATION_REQUIRED',
        message: 'Authorize the export request in Telegram',
        retryable: false,
        retryAfterSeconds: 86400,
        details: { action: 'authorize_takeout_in_telegram' },
      },
    }
    const operation = vi.fn(async () => authorizationRequired)
    const wait = vi.fn(async () => {})

    const result = await retryTelegramResult(operation, { sleep: wait })

    expect(result).toEqual(authorizationRequired)
    expect(operation).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })

  it('classifies thrown network failures before retrying', async () => {
    const networkError = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' })
    const operation = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ ok: true, data: 'done' })

    const result = await retryTelegramResult(operation, { jitterRatio: 0, sleep: async () => {} })

    expect(result).toEqual({ ok: true, data: 'done' })
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('retries an idempotent Telegram read without restarting its surrounding stream', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))
      .mockResolvedValueOnce('page')

    const result = await retryTelegramOperation(operation, { jitterRatio: 0, sleep: async () => {} })

    expect(result).toBe('page')
    expect(operation).toHaveBeenCalledTimes(2)
  })
})
