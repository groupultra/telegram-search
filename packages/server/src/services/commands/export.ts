import type { ExportOptions, ITelegramClientAdapter } from '@tg-search/core'
import type { CommandOptions } from '../../types/apis/command'
import type { WebSocketPeer } from '../../utils/ws'

import { ExportService } from '@tg-search/core'
import { z } from 'zod'

import { BaseCommandHandler } from '../command-manager'

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
 * Export command handler with WebSocket support
 */
export class ExportCommandHandler extends BaseCommandHandler {
  constructor(peer: WebSocketPeer, options?: CommandOptions) {
    super(peer, options)
    this.command.type = 'export'
  }

  async execute(client: ITelegramClientAdapter, params: ExportOptions) {
    try {
      const exportService = new ExportService(client)

      const result = await exportService.exportMessages({
        ...params,
        onProgress: (progress, message, metadata) => {
          if (metadata?.type === 'waiting') {
            this.updateWaiting(progress, message, metadata.waitSeconds!)
          }
          else {
            this.updateProgress(progress, message, metadata)
          }
        },
      })

      this.handleComplete(result)
    }
    catch (error) {
      this.handleError(error as Error)
      throw error
    }
  }
}
