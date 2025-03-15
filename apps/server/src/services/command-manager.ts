import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Command } from '../types/apis/command'
import type { SSEController } from '../types/sse'

import { EmbedCommandHandler } from './commands/embed'
import { ExportCommandHandler } from './commands/export'
import { SearchCommandHandler } from './commands/search'
import { SyncChatsCommandHandler } from './commands/syncChats'
import { SyncMetadataCommandHandler } from './commands/syncMetadata'
import { SSEHandler } from './sse-handler'

export class CommandManager {
  // 直接定义所有命令处理器
  private handlers = {
    export: new ExportCommandHandler(),
    syncMetadata: new SyncMetadataCommandHandler(),
    syncChats: new SyncChatsCommandHandler(),
    embed: new EmbedCommandHandler(),
    search: new SearchCommandHandler(),
  } as const

  /**
   * 执行命令
   */
  async executeCommand<T>(
    command: keyof typeof this.handlers,
    client: ITelegramClientAdapter | null,
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
