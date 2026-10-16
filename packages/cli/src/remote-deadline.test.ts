import type { ReadOperationOptions } from '@tg-search/core'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRemoteRuntime } from './remote'

const input = { source: 'local' as const, chatId: '42', messageIds: ['1'] }
const response = () => Response.json({ ok: true, data: { source: 'local', items: [], missingIds: ['1'] } })

afterEach(() => vi.restoreAllMocks())

describe('remote read deadline options', () => {
  it('does not send HTTP when an option deadline has already expired', async () => {
    // Issue #682: remote mode ignored ReadOperationOptions.deadlineAt and still started the read.
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response())
    const runtime = createRemoteRuntime('https://synthetic.invalid', 'synthetic-token')
    try {
      const options: ReadOperationOptions = { deadlineAt: Date.now() - 1000 }
      const result = await runtime.invokes.messages.get({ ...input, operation: { deadlineAt: Date.now() + 60_000 } }, options)
      expect(result).toMatchObject({ ok: false, error: { code: 'REQUEST_DEADLINE_EXCEEDED' } })
      expect(fetch).not.toHaveBeenCalled()
    }
    finally {
      await runtime.close()
    }
  })

  it.each([undefined, 120_000])('sends an option deadline in the body and overrides input deadlines (%s)', async (inputDuration) => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response())
    const runtime = createRemoteRuntime('https://synthetic.invalid', 'synthetic-token')
    const request = inputDuration === undefined ? input : { ...input, operation: { deadlineAt: Date.now() + inputDuration } }
    const deadlineAt = Date.now() + 60_000
    const original = structuredClone(request)
    try {
      const options: ReadOperationOptions = { deadlineAt }
      const result = await runtime.invokes.messages.get(request, options)
      expect(result).toMatchObject({ ok: true })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ ...request, operation: { deadlineAt } })
      expect(request).toEqual(original)
    }
    finally {
      await runtime.close()
    }
  })

  it('keeps the existing payload when no option deadline is supplied', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response())
    const runtime = createRemoteRuntime('https://synthetic.invalid', 'synthetic-token')
    try {
      await runtime.invokes.messages.get(input)
      expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual(input)
    }
    finally {
      await runtime.close()
    }
  })
})
