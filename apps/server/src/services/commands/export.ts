import type { ExportOptions, ITelegramClientAdapter } from '@tg-search/core'
import type { Command, CommandOptions } from '../../types/apis/command'

import { ExportService } from '@tg-search/core'
import { z } from 'zod'

/**
 * Export command schema
 */
export const exportCommandSchema = z.object({
  chatId: z.number(),
  format: z.enum(['database', 'html', 'json']).optional(),
  messageTypes: z.array(z.enum(['text', 'photo', 'video', 'document', 'sticker', 'other'])).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  limit: z.number().optional(),
  method: z.enum(['getMessage', 'takeout']).optional(),
  minId: z.number().optional(),
  maxId: z.number().optional(),
  incremental: z.boolean().optional(),
})

/**
 * Export command handler
 */
export class ExportCommandHandler {
  private options?: CommandOptions
  private command: Command

  constructor(options?: CommandOptions) {
    this.options = options
    this.command = {
      id: crypto.randomUUID(),
      type: 'export',
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

  async execute(client: ITelegramClientAdapter | null, params: ExportOptions) {
    if (!client) {
      throw new Error('Client is not connected')
    }

    try {
      const exportService = new ExportService(client)

      const result = await exportService.exportMessages({
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
