import type { Command } from '@tg-search/server/types'
import type { SSEClientOptions } from './sse'

import { computed, ref } from 'vue'

import { useSSE } from './sse'

interface CommandHandlerOptions {
  endpoint: string
  errorMessage: string
}

export function useCommandHandler<T extends Record<string, unknown>>(options?: CommandHandlerOptions) {
  const commands = ref<Command[]>([])
  const commandsMap = ref<Map<string, Command>>(new Map())
  const progress = ref<number>(0)
  const error = ref<Error | null>(null)

  const {
    loading: isLoading,
    error: sseError,
    isConnected,
    createConnection,
  } = useSSE<Command, Command>()

  const currentCommand = computed(() => {
    for (const cmd of commandsMap.value.values()) {
      if (cmd.status === 'running')
        return cmd
    }
    return commands.value[0] || null
  })

  function updateCommand(command: Command) {
    commandsMap.value.set(command.id, command)
    commands.value = Array.from(commandsMap.value.values())
  }

  async function executeCommand(params: T) {
    if (!options) {
      throw new Error('CommandHandler options are required for executeCommand')
    }

    // if (currentCommand.value?.status === 'running') {
    //   return { success: false, error: '已有正在进行的任务' }
    // }

    progress.value = 0
    error.value = null

    const sseOptions: SSEClientOptions<Command, Command> = {
      onProgress: (data: Command | string) => {
        if (typeof data !== 'string') {
          updateCommand(data)
          progress.value = data.progress
        }
      },
      onComplete: updateCommand,
      onError: (error) => {
        return { success: false, error }
      },
    }

    try {
      await createConnection(options.endpoint, params, sseOptions)
      return { success: true }
    }
    catch (err) {
      error.value = err instanceof Error ? err : new Error(options.errorMessage)
      return {
        success: false,
        error: error.value,
      }
    }
  }

  function cleanup() {
    error.value = null
    progress.value = 0
    commands.value = []
    commandsMap.value.clear()
  }

  return {
    // 命令状态
    commands,
    currentCommand,
    progress,
    error: computed(() => error.value || sseError.value),

    // 连接状态
    isLoading,
    isStreaming: computed(() => isConnected.value),
    isConnected,

    // 操作方法
    updateCommand,
    executeCommand,
    cleanup,
  }
}
