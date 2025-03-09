import type { ITelegramClientAdapter, MetadataSyncOptions } from '@tg-search/core'
import type { Command, CommandOptions } from '../../types'

import { useLogger } from '@tg-search/common'
import { MetadataSyncServices } from '@tg-search/core'
import { z } from 'zod'

const logger = useLogger()

export const syncMetadataCommandSchema = z.object({})

/**
 * Sync metadata command handler
 */
export class SyncMetadataCommandHandler {
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

  async execute(client: ITelegramClientAdapter, params: MetadataSyncOptions) {
    try {
      logger.debug('执行同步命令')
      const syncService = new MetadataSyncServices(client)
      const result = await syncService.syncChats({
        ...params,
        onProgress: (progress, message, metadata) => {
          if (metadata?.type === 'waiting') {
            this.updateWaiting(progress, message, metadata.waitSeconds)
          }
          else {
            this.updateProgress(progress, message, metadata)
          }
        },
      })
      this.command = {
        ...this.command,
        status: 'completed',
        progress: 100,
        result,
      }
      this.options?.onComplete(this.command)
    }
    catch (error) {
      this.command = {
        ...this.command,
        status: 'failed',
        error: error as Error,
      }
      this.options?.onError(this.command, error as Error)
    }
  }
}
