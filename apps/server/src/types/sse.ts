/**
 * SSE response headers
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

/**
 * SSE stream controller type
 */
export interface SSEController {
  enqueue: (data: Uint8Array) => void
  close: () => void
  complete: <T>(data: T) => void
  error: (error: Error | unknown) => void
  progress: <T>(data: T) => void
}

/**
 * SSE handler options type
 */
export interface SSEHandlerOptions<T = unknown, R = unknown> {
  onProgress?: (data: T | string) => void
  onComplete?: (data: R) => void
  onError?: (error: Error) => void
}

/**
 * SSE event emitter type
 */
export type SSEEventEmitter = Map<string, (data: Uint8Array) => void>
