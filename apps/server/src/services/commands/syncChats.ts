import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Command, CommandOptions } from '../../types'

import { useLogger } from '@tg-search/common'
import { ChatsSyncServices } from '@tg-search/core'
import { z } from 'zod'

const logger = useLogger()

export const syncChatsCommandSchema = z.object({
  chatIds: z.array(z.number()),
  type: z.enum(['metadata', 'messages']).optional(),
  priorities: z.record(z.number(), z.number()).optional(),
  options: z.record(z.number(), z.record(z.string(), z.unknown())).optional(),
})

/**
 * Sync command handler
 */
export class SyncChatsCommandHandler {
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

  private updateProgress(progress: number, message: string, metadata?: Record<string, any>) {
    this.command = {
      ...this.command,
      status: 'running',
      progress,
      message,
      metadata,
    }
    this.options?.onProgress(this.command)
  }

  private updateWaiting(progress: number, message: string, waitSeconds: number) {
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
    this.options?.onProgress(this.command)
  }

  async execute(client: ITelegramClientAdapter | null, params: z.infer<typeof syncChatsCommandSchema>) {
    if (!client) {
      throw new Error('Client is not connected')
    }

    try {
      logger.debug('执行同步命令')
      const syncService = new ChatsSyncServices(client)
      await syncService.startMultiSync({
        chatIds: params.chatIds,
        type: params.type,
        priorities: params.priorities,
        options: params.options,
        onProgress: (progress: number, message: string, metadata?: { type?: string, waitSeconds?: number }) => {
          if (metadata?.type === 'waiting' && metadata.waitSeconds !== undefined) {
            this.updateWaiting(progress, message, metadata.waitSeconds)
          }
          else {
            this.updateProgress(progress, message, {
              ...metadata,
              command: 'sync',
              chatIds: params.chatIds,
              type: params.type,
            })
          }
        },
      })

      this.command = {
        ...this.command,
        status: 'completed',
        progress: 100,
        message: '同步完成',
        metadata: {
          command: 'sync',
          chatIds: params.chatIds,
          type: params.type,
        },
      }
      this.options?.onComplete(this.command)
    }
    catch (error) {
      this.command = {
        ...this.command,
        status: 'failed',
        error: error as Error,
        metadata: {
          command: 'sync',
          chatIds: params.chatIds,
          type: params.type,
        },
      }
      this.options?.onError(this.command, error as Error)
    }
  }
}
