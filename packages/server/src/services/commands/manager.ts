import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Command } from '../../types/apis/command'
import type { SSEController } from '../../types/sse'

import { SSEHandler } from '../sse-handler'
import { ExportCommandHandler } from './export'
import { SyncChatsCommandHandler } from './syncChats'
import { SyncMetadataCommandHandler } from './syncMetadata'

export class CommandManager {
  // 直接定义所有命令处理器
  private handlers = {
    export: new ExportCommandHandler(),
    syncMetadata: new SyncMetadataCommandHandler(),
    syncChats: new SyncChatsCommandHandler(),
  } as const

  /**
   * 执行命令
   */
  async executeCommand<T>(
    command: keyof typeof this.handlers,
    client: ITelegramClientAdapter,
    params: T,
    controller: SSEController,
  ) {
    const handler = this.handlers[command]
    const sseHandler = new SSEHandler(controller)

    Object.assign(handler, {
      options: {
        onProgress: (command: Command) => sseHandler.sendProgress(command),
        onComplete: (command: Command) => sseHandler.complete(command),
        onError: (_command: Command, error: Error) => sseHandler.error(error),
      },
    })

    await handler.execute(client, params as any)
  }
}
