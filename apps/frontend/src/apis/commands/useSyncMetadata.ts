import type { SyncParams } from '@tg-search/server'

import { onUnmounted } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useSyncMetadata() {
  const {
    currentCommand,
    progress: syncProgress,
    executeCommand,
    cleanup,
    updateCommand,
  } = useCommandHandler<SyncParams>({
    endpoint: '/commands/sync',
    errorMessage: '同步失败',
  })

  // 包装 executeCommand 以确保正确的清理
  const executeMetadataSync = async (params: SyncParams) => {
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
    syncProgress,
    executeMetadataSync,
    updateCommand,
    cleanup,
  }
}
