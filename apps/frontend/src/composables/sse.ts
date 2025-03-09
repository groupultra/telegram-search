import type { ApiError, ApiResponse, SSEHandlerOptions } from '@tg-search/server'

import { ref } from 'vue'

import { API_BASE } from '../constants'
import { useSession } from './useSession'

interface SSEEvent {
  event: string
  data: string
}

export type SSEClientOptions<T, R> = SSEHandlerOptions<T, R> & {
  signal?: AbortSignal
}

/**
 * Parse SSE events from raw response data
 */
function parseSSEEvents(chunk: Uint8Array): SSEEvent[] {
  const decoder = new TextDecoder()
  const text = decoder.decode(chunk, { stream: true })
  const events: SSEEvent[] = []

  const lines = text.split('\n')
  let currentEvent: Partial<SSEEvent> = {}

  for (const line of lines) {
    if (!line.trim()) {
      if (currentEvent.data) {
        events.push(currentEvent as SSEEvent)
        currentEvent = {}
      }
      continue
    }

    if (line.startsWith('event: ')) {
      currentEvent.event = line.slice(7).trim()
    }
    else if (line.startsWith('data: ')) {
      currentEvent.data = line.slice(6).trim()
    }
  }

  return events
}

/**
 * SSE composable for handling server-sent events
 */
export function useSSE<T = unknown, R = unknown>() {
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const isConnected = ref(false)

  const {
    attempts: reconnectAttempts,
    maxAttempts: maxReconnectAttempts,
    calculateDelay: reconnectDelay,
    resetAttempts,
    recordAttempt,
  } = useSession()

  async function createConnection(
    url: string,
    params: Record<string, unknown>,
    handlers: SSEHandlerOptions<T, R>,
  ) {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error('Failed to connect to SSE')
      }

      const reader = response.body?.getReader()
      if (!reader)
        throw new Error('No response body')

      isConnected.value = true
      resetAttempts()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done)
            break

          const events = parseSSEEvents(value)
          for (const event of events) {
            const data = JSON.parse(event.data) as ApiResponse<T | R>

            switch (event.event) {
              case 'progress': {
                // eslint-disable-next-line no-console
                console.log('[SSE] Received progress event:', data)

                if (data.success && data.data) {
                  handlers.onProgress?.(data.data as T)
                }
                break
              }
              case 'complete': {
                // eslint-disable-next-line no-console
                console.log('[SSE] Received complete event:', data)

                if (data.success && data.data) {
                  handlers.onComplete?.(data.data as R)
                }
                isConnected.value = false
                resetAttempts()
                break
              }
              case 'error': {
                console.error('[SSE] Received error event:', data)

                handlers.onError?.(new Error(data.message || 'Unknown error') as ApiError)
                isConnected.value = false
                recordAttempt()
                break
              }
            }
          }
        }
      }
      finally {
        reader.cancel()
      }
    }
    catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          isConnected.value = false
          return
        }
        recordAttempt()
      }

      const message = e instanceof Error ? e.message : 'Unknown error'
      error.value = message
      isConnected.value = false
      handlers.onError?.(new Error(message))
    }
    finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    isConnected,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectDelay,
    createConnection,
  }
}
