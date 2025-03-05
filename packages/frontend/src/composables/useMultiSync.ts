import type { SyncConfigItem } from '@tg-search/db'

import { ref } from 'vue'

interface MultiSyncOptions {
  chatIds: number[]
  type?: 'metadata' | 'messages'
  priorities?: Record<number, number>
  options?: Record<number, Record<string, any>>
}

export function useMultiSync() {
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const executeMultiSync = async (options: MultiSyncOptions) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch('/api/commands/multi-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      })

      if (!response.ok) {
        throw new Error('Failed to start multi-sync')
      }

      // Handle SSE response
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: '))
            continue

          const data = JSON.parse(line.slice(6))
          if (data.type === 'error') {
            throw new Error(data.error)
          }
        }
      }
    }
    catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      throw error.value
    }
    finally {
      isLoading.value = false
    }
  }

  const getSyncStatus = async (chatId: number, type?: string): Promise<SyncConfigItem | null> => {
    try {
      const response = await fetch(`/api/commands/sync-status?chatId=${chatId}${type ? `&type=${type}` : ''}`)
      if (!response.ok) {
        throw new Error('Failed to get sync status')
      }
      return await response.json()
    }
    catch (e) {
      console.error('Failed to get sync status:', e)
      return null
    }
  }

  const cancelSync = async (chatId: number, type?: string) => {
    try {
      const response = await fetch('/api/commands/cancel-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, type }),
      })

      if (!response.ok) {
        throw new Error('Failed to cancel sync')
      }
    }
    catch (e) {
      console.error('Failed to cancel sync:', e)
      throw e
    }
  }

  return {
    isLoading,
    error,
    executeMultiSync,
    getSyncStatus,
    cancelSync,
  }
}
