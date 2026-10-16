import { ApplicationError } from './errors'

/** A single read's lifetime. Cancellation never owns the shared Telegram connection. */
export interface ReadOperationOptions {
  signal?: AbortSignal
  deadlineAt?: number
}

export class ReadOperationError extends ApplicationError {
  constructor(public code: 'REQUEST_CANCELLED' | 'REQUEST_DEADLINE_EXCEEDED', message: string, public details?: Record<string, unknown>) {
    super({ code, message, retryable: false, details })
    this.name = 'ReadOperationError'
  }
}

export interface ReadOperationScope {
  signal: AbortSignal
  throwIfAborted: () => void
  wait: <T>(operation: Promise<T>) => Promise<T>
  telegram: <T>(client: object, operation: () => Promise<T>) => Promise<T>
}

export async function withReadOperation<T>(options: ReadOperationOptions = {}, operation: (scope: ReadOperationScope) => Promise<T>): Promise<T> {
  const deadlineAt = options.deadlineAt ?? Date.now() + 60_000
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let sdkRequests = 0
  const cancellationError = (expired: boolean) => {
    return new ReadOperationError(
      expired ? 'REQUEST_DEADLINE_EXCEEDED' : 'REQUEST_CANCELLED',
      expired ? 'Read deadline exceeded' : 'Read cancelled',
      sdkRequests > 0 ? { sdkCancellation: 'unsupported', inFlightMayContinue: true } : undefined,
    )
  }
  const onAbort = () => controller.abort(cancellationError(false))
  const onDeadline = () => controller.abort(cancellationError(true))
  options.signal?.addEventListener('abort', onAbort, { once: true })
  if (options.signal?.aborted)
    onAbort()
  {
    const remaining = deadlineAt - Date.now()
    if (remaining <= 0)
      onDeadline()
    else
      timer = setTimeout(onDeadline, remaining)
  }
  const throwIfAborted = () => {
    if (controller.signal.aborted)
      throw controller.signal.reason
  }
  const wait = async <Result>(pending: Promise<Result>): Promise<Result> => {
    throwIfAborted()
    return new Promise<Result>((resolve, reject) => {
      const onCancel = () => {
        controller.signal.removeEventListener('abort', onCancel)
        reject(controller.signal.reason)
      }
      controller.signal.addEventListener('abort', onCancel, { once: true })
      pending.then((value) => {
        controller.signal.removeEventListener('abort', onCancel)
        if (controller.signal.aborted)
          reject(controller.signal.reason)
        else
          resolve(value)
      }, (error) => {
        controller.signal.removeEventListener('abort', onCancel)
        reject(error)
      })
    })
  }
  const telegram: ReadOperationScope['telegram'] = async (_client, invoke) => {
    throwIfAborted()
    sdkRequests++
    // NOTICE: GramJS 2.26 has no public cancellation for an individual RPC.
    // Observe late settlement and stop this operation before it creates a next
    // page; shared client lifetime remains the runtime owner's responsibility.
    const pending = Promise.resolve().then(invoke).finally(() => {
      sdkRequests--
    })
    return wait(pending)
  }
  try {
    throwIfAborted()
    return await wait(operation({ signal: controller.signal, throwIfAborted, wait, telegram }))
  }
  finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}
