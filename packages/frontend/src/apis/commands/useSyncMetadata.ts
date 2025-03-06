import type { SyncParams } from '@tg-search/server'

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

  return {
    currentCommand,
    syncProgress,
    executeSync: executeCommand,
    updateCommand,
    cleanup,
  }
}
