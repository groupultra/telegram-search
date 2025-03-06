import type { SyncConfigItem } from '@tg-search/db'
import type { SyncParams } from '@tg-search/server'

import { onUnmounted } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useSyncChats() {
  const {
    currentCommand,
    runningCommands,
    progress: syncProgress,
    currentMessage,
    status,
    error,
    executeCommand,
    cleanup,
    updateCommand,
    runningCommandsCount,
  } = useCommandHandler<SyncParams>({
    endpoint: '/commands/multi-sync',
    errorMessage: '同步失败',
    maxParallelCommands: 3, // 允许最多3个并行同步任务
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
      cleanup() // 确保在取消同步后清理状态
    }
    catch (e) {
      console.error('Failed to cancel sync:', e)
      cleanup() // 在错误时也清理状态
      throw e
    }
  }

  // 包装 executeCommand 以确保正确的清理
  const executeMultiSync = async (params: SyncParams) => {
    try {
      const result = await executeCommand(params)
      if (!result.success) {
        cleanup()
      }
      return result
    }
    catch (e) {
      cleanup()
      throw e
    }
  }

  // 组件卸载时清理
  onUnmounted(() => {
    cleanup()
  })

  return {
    currentCommand,
    runningCommands,
    syncProgress,
    currentMessage,
    status,
    error,
    executeMultiSync,
    getSyncStatus,
    cancelSync,
    updateCommand,
    cleanup,
    runningCommandsCount,
  }
}
