import type { ExportParams } from '@tg-search/server/types'

import { onUnmounted, ref } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useExport() {
  const {
    currentCommand,
    runningCommands,
    progress: exportProgress,
    currentMessage,
    status,
    executeCommand,
    cleanup: baseCleanup,
    runningCommandsCount,
  } = useCommandHandler<ExportParams>({
    endpoint: '/commands/export',
    errorMessage: '导出失败',
    maxParallelCommands: 2, // 允许最多2个并行导出任务
  })

  const lastExportParams = ref<ExportParams | null>(null)

  async function executeExport(params: ExportParams) {
    try {
      lastExportParams.value = params
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

  function cleanup() {
    baseCleanup()
    lastExportParams.value = null
  }

  // 组件卸载时清理
  onUnmounted(() => {
    cleanup()
  })

  return {
    currentCommand,
    runningCommands,
    exportProgress,
    currentMessage,
    status,
    lastExportParams,
    executeExport,
    cleanup,
    runningCommandsCount,
  }
}
