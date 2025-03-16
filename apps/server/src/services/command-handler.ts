import type { ITelegramClientAdapter } from '@tg-search/core'
import type { CommandParams, CommandType, ErrorCommand, PendingCommand, ProgressCommandWithMetadata, ResultCommandWithMetadata } from '../types'

interface CommandCallback<T extends CommandType> {
  onProgress: (command: ProgressCommandWithMetadata<T>) => void
  onComplete: (command: ResultCommandWithMetadata<T>) => void
  onError: (command: ErrorCommand) => void
}

/**
 * Base class for command handlers
 */
export abstract class CommandHandlerBase<T extends CommandType> {
  protected command: PendingCommand | ProgressCommandWithMetadata<T> | ResultCommandWithMetadata<T> | ErrorCommand
  protected client: ITelegramClientAdapter | null = null
  protected callback: CommandCallback<T> | null = null

  constructor(key: T) {
    this.command = {
      id: crypto.randomUUID(),
      type: key,
      status: 'pending',
    }
  }

  public init(client?: ITelegramClientAdapter, callback?: CommandCallback<T>) {
    this.client = client ?? null
    this.callback = callback ?? null
  }

  abstract execute(params: CommandParams<T>): Promise<void>
}
