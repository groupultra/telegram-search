import type { Command } from '@tg-search/server'
import type { SSEClientOptions } from '../../composables/sse'
import type { SyncParams } from './../../../../server/src/types/apis/sync'

import { ref } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useSyncMetadata() {
  const {
    currentCommand,
    updateCommand,
    createConnection,
    ...commandHandler
  } = useCommandHandler()

  const syncProgress = ref<number>(0)

  async function executeSync(params: SyncParams) {
    if (currentCommand.value?.status === 'running') {
      return { success: false, error: '已有正在进行的同步任务' }
    }
    syncProgress.value = 0
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
      await createConnection('/commands/sync', params, options)
      return { success: true }
    }
    catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error('同步失败'),
      }
    }
  }

  function cleanup() {
    commandHandler.cleanup()
    syncProgress.value = 0
  }

  return {
    ...commandHandler,
    currentCommand,
    syncProgress,
    executeSync,
    updateCommand,
    cleanup,
  }
}
