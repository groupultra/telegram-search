import { Api } from 'telegram'
import { invoke as invokeGramJs } from 'telegram/client/users'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { withReadOperation } from './read-operation'

const flush = () => new Promise<void>(resolve => queueMicrotask(resolve))

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('read operation lifetime (issue #682)', () => {
  it('documents the real GramJS request cancellation boundary without a network connection', async () => {
    // GramJS owns RequestState and exposes no public cancellation argument.
    let pending!: { reject: (error: Error) => void }
    const fakeClient = {
      _sender: { userDisconnected: false, addStateToQueue: (state: typeof pending) => { pending = state } },
      _connectedDeferred: { promise: Promise.resolve() },
      _requestRetries: 1,
    } as unknown as Parameters<typeof invokeGramJs>[0]
    const controller = new AbortController()
    const sdk = invokeGramJs(fakeClient, new Api.updates.GetState())
    const sdkSettled = vi.fn()
    void sdk.then(sdkSettled, sdkSettled)
    const read = withReadOperation({ signal: controller.signal }, scope => scope.telegram(fakeClient, () => sdk))
    await flush()
    const cancelled = expect(read).rejects.toMatchObject({ code: 'REQUEST_CANCELLED', details: { sdkCancellation: 'unsupported', inFlightMayContinue: true } })
    controller.abort()
    await cancelled
    expect(sdkSettled).not.toHaveBeenCalled()
    pending.reject(new Error('test cleanup'))
    await expect(sdk).rejects.toThrow('test cleanup')
  })

  it('ends a stuck read at its deadline and reports that the SDK cannot cancel it', async () => {
    vi.useFakeTimers()
    const client = {}
    let settle!: (value: string) => void
    const sdkRequest = new Promise<string>((resolve) => {
      settle = resolve
    })
    const operation = withReadOperation({ deadlineAt: Date.now() + 20 }, scope => scope.telegram(client, () => sdkRequest))
    const failure = expect(operation).rejects.toMatchObject({ code: 'REQUEST_DEADLINE_EXCEEDED', details: { sdkCancellation: 'unsupported', inFlightMayContinue: true } })
    await vi.advanceTimersByTimeAsync(20)
    await failure
    const subsequent = vi.fn(async () => 'new request')
    await expect(withReadOperation({}, scope => scope.telegram(client, subsequent))).resolves.toBe('new request')
    expect(subsequent).toHaveBeenCalledTimes(1)
    settle('late result')
    await flush()
    await expect(withReadOperation({}, scope => scope.telegram(client, subsequent))).resolves.toBe('new request')
  })

  it('preserves the deadline cause when a timer fires before the wall clock reaches it', async () => {
    vi.useFakeTimers()
    const deadlineAt = Date.now() + 100
    const operation = withReadOperation({ deadlineAt }, scope => scope.wait(new Promise<void>(() => {})))
    const rejected = expect(operation).rejects.toMatchObject({ code: 'REQUEST_DEADLINE_EXCEEDED' })
    // Timer scheduling and Date.now can disagree by a millisecond; the timer's
    // explicit cause must win over a fresh wall-clock comparison (issue #682).
    vi.spyOn(Date, 'now').mockReturnValue(deadlineAt - 1)
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(Date.now()).toBe(deadlineAt - 1)
  })

  it('cancels only one request, prevents its next page, and leaves another request running', async () => {
    const client = {}
    const abort = new AbortController()
    let settle!: () => void
    const nextPage = vi.fn()
    const first = withReadOperation({ signal: abort.signal }, async (scope) => {
      await scope.telegram(client, () => new Promise<void>((resolve) => {
        settle = resolve
      }))
      nextPage()
    })
    const other = withReadOperation({}, scope => scope.telegram(client, async () => 'other result'))
    await expect(other).resolves.toBe('other result')
    const failure = expect(first).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' })
    abort.abort()
    await failure
    settle()
    await flush()
    expect(nextPage).not.toHaveBeenCalled()
  })

  it('rejects an expired request before starting work and removes its abort listener', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const operation = vi.fn(async () => 1)
    await expect(withReadOperation({ signal: controller.signal, deadlineAt: Date.now() - 1 }, operation)).rejects.toMatchObject({ code: 'REQUEST_DEADLINE_EXCEEDED' })
    expect(operation).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })
})
