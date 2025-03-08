import type { SSEController } from '../types/sse'
import type { WebSocketPeer } from '../utils/ws'

import { createSSEMessage } from '../utils/sse'

/**
 * Adapter to convert SSE controller to WebSocket peer interface
 */
export class SSEHandler implements WebSocketPeer {
  id: string
  private controller: SSEController

  constructor(controller: SSEController) {
    this.id = crypto.randomUUID()
    this.controller = controller
  }

  send(data: unknown): void {
    if (typeof data === 'string') {
      // Parse the WebSocket message to extract type and data
      try {
        const message = JSON.parse(data)
        switch (message.type) {
          case 'progress':
          case 'waiting':
            this.controller.enqueue(createSSEMessage(message.type, message.data))
            break
          case 'complete':
            this.controller.complete(message.data)
            break
          case 'error':
            this.controller.error(new Error(message.error))
            break
          default:
            this.controller.enqueue(createSSEMessage('message', message))
        }
      }
      catch {
        // If parsing fails, send as raw message
        this.controller.enqueue(createSSEMessage('message', data))
      }
    }
    else {
      // For non-string data, send as is
      this.controller.enqueue(createSSEMessage('message', data))
    }
  }
}
