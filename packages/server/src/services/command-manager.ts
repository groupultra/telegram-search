import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Command, CommandOptions } from '../types'
import type { WebSocketPeer } from '../utils/ws'

import { createErrorMessage, createSuccessMessage, sendMessage } from '../utils/ws'
import { EmbedCommandHandler } from './commands/embed'
import { ExportCommandHandler } from './commands/export'
import { SyncChatsCommandHandler } from './commands/syncChats'
import { SyncMetadataCommandHandler } from './commands/syncMetadata'

/**
 * Base command handler with WebSocket support
 */
export abstract class BaseCommandHandler {
  protected command: Command
  protected peer: WebSocketPeer
  protected options?: CommandOptions

  constructor(peer: WebSocketPeer, options?: CommandOptions) {
    this.peer = peer
    this.options = options
    this.command = {
      id: crypto.randomUUID(),
      type: 'sync',
      status: 'pending',
      progress: 0,
      message: '',
    }
  }

  protected updateProgress(progress: number, message: string, metadata?: Record<string, any>) {
    this.command = {
      ...this.command,
      status: 'running',
      progress,
      message,
      metadata,
    }
    sendMessage(this.peer, createSuccessMessage('progress', this.command))
    this.options?.onProgress?.(this.command)
  }

  protected updateWaiting(progress: number, message: string, waitSeconds: number) {
    this.command = {
      ...this.command,
      status: 'waiting',
      progress,
      message,
      metadata: {
        waitSeconds,
        resumeTime: new Date(Date.now() + waitSeconds * 1000).toISOString(),
      },
    }
    sendMessage(this.peer, createSuccessMessage('waiting', this.command))
    this.options?.onProgress?.(this.command)
  }

  protected handleComplete(result?: unknown) {
    this.command = {
      ...this.command,
      status: 'completed',
      progress: 100,
      result,
    }
    sendMessage(this.peer, createSuccessMessage('complete', this.command))
    this.options?.onComplete?.(this.command)
  }

  protected handleError(error: Error) {
    this.command = {
      ...this.command,
      status: 'failed',
      error,
    }
    sendMessage(this.peer, createErrorMessage('error', error))
    this.options?.onError?.(this.command, error)
  }

  abstract execute(client: ITelegramClientAdapter, params: unknown): Promise<void>
}

/**
 * Command manager that handles all command types
 */
export class CommandManager {
  // Command handlers with their types
  private handlers = {
    export: ExportCommandHandler,
    syncMetadata: SyncMetadataCommandHandler,
    syncChats: SyncChatsCommandHandler,
    embed: EmbedCommandHandler,
  } as const

  /**
   * Execute a command with WebSocket support
   */
  async executeCommand<T>(
    command: keyof typeof this.handlers,
    client: ITelegramClientAdapter,
    params: T,
    peer: WebSocketPeer,
    options?: CommandOptions,
  ) {
    const HandlerClass = this.handlers[command]
    const handler = new HandlerClass(peer, options)

    await handler.execute(client, params as any)
  }
}
