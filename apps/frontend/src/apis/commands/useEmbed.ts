import type { EmbedParams } from '@tg-search/server'

import { onUnmounted } from 'vue'

import { useCommandHandler } from '../../composables/useCommands'

export function useEmbed() {
  const {
    currentCommand,
    progress: embedProgress,
    executeCommand,
    cleanup,
    updateCommand,
  } = useCommandHandler<EmbedParams>({
    endpoint: '/commands/embed',
    errorMessage: '向量嵌入生成失败',
  })

  // 包装 executeCommand 以确保正确的清理
  const executeEmbed = async (params: EmbedParams) => {
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
    embedProgress,
    executeEmbed,
    updateCommand,
    cleanup,
  }
}
