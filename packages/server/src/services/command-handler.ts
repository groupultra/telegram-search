import type { SSEController, SSEHandlerOptions } from '../types/sse'
import type { WebSocketPeer } from '../utils/ws'

import { createErrorMessage, createSuccessMessage } from '../utils/ws'
import { SSEHandler } from './sse-handler'

/**
 * Command handler that supports both WebSocket and SSE
 * Uses WebSocket architecture internally and provides SSE compatibility through an adapter
 */
export class CommandHandler<T = unknown> {
  private peer: WebSocketPeer

  constructor(
    controller: SSEController,
    private options?: SSEHandlerOptions<T>,
  ) {
    // Create a WebSocket peer adapter from the SSE controller
    this.peer = new SSEHandler(controller)
  }

  sendProgress(data: T | string) {
    // Use WebSocket message format internally
    this.peer.send(createSuccessMessage('progress', data))
    if (typeof data !== 'string') {
      this.options?.onProgress?.(data)
    }
  }

  complete<R = unknown>(data: R) {
    // Use WebSocket message format internally
    this.peer.send(createSuccessMessage('complete', data))
    this.options?.onComplete?.(data as any)
  }

  error(error: Error) {
    // Use WebSocket message format internally
    this.peer.send(createErrorMessage('error', error))
    this.options?.onError?.(error)
  }
}
