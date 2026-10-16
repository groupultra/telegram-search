import type { ReadOperationOptions } from '../application/read-operation'

/** Eventa's abort controller belongs to one invoke, never the shared client. */
export function readOperationOptions(contextSignal: AbortSignal, input: { operation?: { deadlineAt: number } }, invoke?: { abortController?: AbortController }): ReadOperationOptions {
  return {
    signal: invoke?.abortController ? AbortSignal.any([contextSignal, invoke.abortController.signal]) : contextSignal,
    deadlineAt: input.operation?.deadlineAt,
  }
}
