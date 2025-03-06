import type { SyncParams } from '@tg-search/server'

import { onUnmounted } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useSyncMetadata() {
  const {
    currentCommand,
    runningCommands,
    progress: syncProgress,
    currentMessage,
    status,
    executeCommand,
    cleanup,
    updateCommand,
    runningCommandsCount,
  } = useCommandHandler<SyncParams>({
    endpoint: '/commands/sync',
    errorMessage: '同步失败',
    maxParallelCommands: 3, // 允许最多3个并行同步任务
  })

  // 包装 executeCommand 以确保正确的清理
  const executeSync = async (params: SyncParams) => {
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
    executeSync,
    updateCommand,
    cleanup,
    runningCommandsCount,
  }
}
