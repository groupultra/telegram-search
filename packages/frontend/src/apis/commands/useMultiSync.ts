import type { SyncConfigItem } from '@tg-search/db'
import type { Command, SyncParams } from '@tg-search/server'
import type { SSEClientOptions } from '../../composables/sse'

import { ref } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useMultiSync() {
  const {
    currentCommand,
    updateCommand,
    createConnection,
    ...commandHandler
  } = useCommandHandler()

  const syncProgress = ref<number>(0)
  const error = ref<Error | null>(null)

  async function executeMultiSync(params: SyncParams) {
    if (currentCommand.value?.status === 'running') {
      return { success: false, error: '已有正在进行的同步任务' }
    }

    syncProgress.value = 0
    error.value = null

    const options: SSEClientOptions<Command, Command> = {
      onProgress: (data: Command | string) => {
        if (typeof data !== 'string') {
          updateCommand(data)
          syncProgress.value = data.progress
        }
      },
      onComplete: updateCommand,
      onError: (error) => {
        return { success: false, error }
      },
    }

    try {
      await createConnection('/commands/multi-sync', params, options)
      return { success: true }
    }
    catch (err) {
      error.value = err instanceof Error ? err : new Error('同步失败')
      return {
        success: false,
        error: error.value,
      }
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

  function cleanup() {
    commandHandler.cleanup()
    syncProgress.value = 0
    error.value = null
  }

  return {
    ...commandHandler,
    currentCommand,
    syncProgress,
    error,
    executeMultiSync,
    getSyncStatus,
    cancelSync,
    updateCommand,
    cleanup,
  }
}
