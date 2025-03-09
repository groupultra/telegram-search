import type { ErrorResponse, SuccessResponse } from '@tg-search/server'

import { ofetch } from 'ofetch'
import { ref } from 'vue'

import { API_BASE, API_CONFIG } from '../constants'

// Create API client instance with default configuration
export const apiFetch = ofetch.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  ...API_CONFIG,
})

/**
 * Type-safe wrapper around apiFetch that handles API response types
 * @template T The expected data type
 */
export function apiRequest<T>(
  url: string,
  options?: Parameters<typeof apiFetch>[1] & { responseType?: 'json' },
): Promise<SuccessResponse<T> | ErrorResponse> {
  return apiFetch<SuccessResponse<T> | ErrorResponse>(url, options)
}

// TODO: refactor
// TODO: pinia
/**
 * Vue composable for managing API state and requests
 */
export function useApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Store controllers for all requests in a Map
  const controllers = new Map<string, AbortController>()

  /**
   * Generic API request wrapper with state management
   */
  const request = async <T>(
    fn: () => Promise<SuccessResponse<T> | ErrorResponse>,
    options?: {
      key?: string // Unique key for cancellation
      timeout?: number
    },
  ): Promise<T> => {
    const controller = new AbortController()
    const requestKey = options?.key || Date.now().toString()

    // Store controller
    controllers.set(requestKey, controller)

    try {
      loading.value = true
      error.value = null

      const response = await Promise.race([
        fn().then(r => r).catch((error) => {
          if (error.name === 'AbortError')
            throw error
          return { success: false, error: error.message, code: 'UNKNOWN_ERROR' } as ErrorResponse
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), options?.timeout || 30000)
        }),
      ])

      if (!response.success) {
        throw new Error((response as ErrorResponse).error)
      }

      // Handle null case to satisfy TypeScript type check
      if ('data' in response && response.data === null) {
        throw new Error('Response data is null')
      }

      return response.data
    }
    catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      error.value = message
      console.error('API Error:', message)
      throw e
    }
    finally {
      loading.value = false
      controllers.delete(requestKey)
    }
  }

  // Add cancellation method
  const cancelRequest = (key: string) => {
    controllers.get(key)?.abort()
    controllers.delete(key)
  }

  return {
    loading,
    error,
    request,
    cancelRequest,
  }
}
