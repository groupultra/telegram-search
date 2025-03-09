import type { SyncParams } from '@tg-search/server'

import { onUnmounted } from 'vue'

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
    endpoint: '/commands/sync-chats',
    errorMessage: '同步失败',
  })

  // 包装 executeCommand 以确保正确的清理
  const executeChatsSync = async (params: SyncParams) => {
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
    error,
    executeChatsSync,
    updateCommand,
    cleanup,
  }
}
