import type { SSEController } from '../types/sse'

import { SSE_HEADERS } from '../types/sse'
import { createErrorResponse, createResponse } from './response'

/**
 * SSE message creator
 */
export function createSSEMessage(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * Create SSE response with error handling
 */
export function createSSEResponse(
  handler: (controller: SSEController) => Promise<void> | void,
) {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const sseController: SSEController = {
          enqueue: data => controller.enqueue(data),
          close: () => {
            if (!isStreamClosed(controller)) {
              controller.close()
            }
          },
          complete: (data) => {
            if (!isStreamClosed(controller)) {
              controller.enqueue(createSSEMessage('complete', createResponse(data)))
            }
          },
          error: (err) => {
            if (!isStreamClosed(controller)) {
              controller.enqueue(createSSEMessage('error', createErrorResponse(err)))
            }
          },
          progress: (data) => {
            if (!isStreamClosed(controller)) {
              controller.enqueue(createSSEMessage('progress', createResponse(data)))
            }
          },
        }

        try {
          await handler(sseController)
          // 确保处理完成后关闭
          controller.close()
        }
        catch (err) {
          sseController.error(err)
        }
      },
    }),
    { headers: SSE_HEADERS },
  )
}

/**
 * Check if the stream is closed
 */
function isStreamClosed(controller: ReadableStreamDefaultController) {
  return controller.desiredSize === null
}
