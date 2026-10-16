import type { ReadOperationOptions } from '@tg-search/core'

import { toAppError, withReadOperation } from '@tg-search/core'

/** Preserve one absolute deadline across every transport hop. No transport retries. */
export function bindReadOperations<Runtime extends { invokes: object }>(runtime: Runtime, options: Required<Pick<ReadOperationOptions, 'signal' | 'deadlineAt'>>): Runtime {
  type Invoke = (input: Record<string, unknown>, options?: ReadOperationOptions) => Promise<unknown>
  const source = runtime.invokes as Record<string, Record<string, Invoke>>
  const invokes: Record<string, Record<string, Invoke>> = { ...source }
  for (const group of ['chats', 'messages', 'stats']) {
    invokes[group] = Object.fromEntries(Object.entries(source[group]).map(([name, invoke]) => [name, async (input: Record<string, unknown>, requestOptions?: ReadOperationOptions) => {
      try {
        return await withReadOperation({ ...options, signal: requestOptions?.signal ? AbortSignal.any([options.signal, requestOptions.signal]) : options.signal }, scope => scope.wait(invoke({ ...input, operation: { deadlineAt: options.deadlineAt } }, { signal: scope.signal })))
      }
      catch (error) {
        // Eventa rejects on transport cancellation; keep the CLI error envelope stable.
        if (options.signal.aborted)
          return { ok: false, error: { code: 'REQUEST_CANCELLED', message: 'Read cancelled', retryable: false } }
        return { ok: false, error: toAppError(error) }
      }
    }]))
  }
  return { ...runtime, invokes } as Runtime
}
