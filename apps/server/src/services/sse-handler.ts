import type { SSEController, SSEHandlerOptions } from '../types/sse'

import { createResponse } from '../utils/response'
import { createSSEMessage } from '../utils/sse'

export class SSEHandler<T = unknown> {
  constructor(
    private controller: SSEController,
    private options?: SSEHandlerOptions<T>,
  ) {}

  sendProgress(data: T | string) {
    this.controller.enqueue(createSSEMessage('progress', createResponse(data)))
    if (typeof data !== 'string') {
      this.options?.onProgress?.(data)
    }
  }

  complete<R = unknown>(data: R) {
    this.controller.complete(data)
    this.options?.onComplete?.(data as any)
  }

  error(error: Error) {
    this.controller.error(error)
    this.options?.onError?.(error)
  }
}
