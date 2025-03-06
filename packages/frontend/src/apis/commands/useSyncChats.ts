import type { SyncConfigItem } from '@tg-search/db'
import type { SyncParams } from '@tg-search/server'

import { useCommandHandler } from '../../composables/useCommands'

export function useSyncChats() {
  const {
    currentCommand,
    progress: syncProgress,
    error,
    executeCommand,
    cleanup,
    updateCommand,
  } = useCommandHandler<SyncParams>({
    endpoint: '/commands/multi-sync',
    errorMessage: '同步失败',
  })

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
    currentCommand,
    syncProgress,
    error,
    executeMultiSync: executeCommand,
    getSyncStatus,
    cancelSync,
    updateCommand,
    cleanup,
  }
}
