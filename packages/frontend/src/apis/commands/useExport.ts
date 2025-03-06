import type { ExportParams } from '@tg-search/server/types'

import { ref } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useExport() {
  const {
    currentCommand,
    progress: exportProgress,
    executeCommand,
    cleanup: baseCleanup,
  } = useCommandHandler<ExportParams>({
    endpoint: '/commands/export',
    errorMessage: '导出失败',
  })

  const lastExportParams = ref<ExportParams | null>(null)

  async function executeExport(params: ExportParams) {
    lastExportParams.value = params
    return executeCommand(params)
  }

  function cleanup() {
    baseCleanup()
    lastExportParams.value = null
  }

  return {
    currentCommand,
    exportProgress,
    lastExportParams,
    executeExport,
    cleanup,
  }
}
