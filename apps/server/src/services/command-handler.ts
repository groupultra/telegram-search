import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Command, CommandOptions, CommandStatus } from '../types'

export abstract class CommandHandlerBase {
  private options?: CommandOptions
  private command: Command

  constructor(options?: CommandOptions) {
    this.options = options
    this.command = {
      id: crypto.randomUUID(),
      type: 'sync',
      status: 'pending',
      progress: 0,
      message: '',
    }
  }

  protected updateStatus(status: CommandStatus, progress: number, message: string, metadata?: Record<string, any>) {
    this.command = {
      ...this.command,
      status,
      progress,
      message,
      metadata,
    }

    switch (status) {
      case 'running':
        this.options?.onProgress(this.command)
        break
      case 'completed':
        this.options?.onComplete(this.command)
        break
      case 'failed':
        this.options?.onError(this.command, metadata?.error as Error)
        break
      case 'waiting':
        this.options?.onProgress(this.command)
        break
    }
  }

  abstract execute(client: ITelegramClientAdapter | null, params: any): Promise<void>
}
