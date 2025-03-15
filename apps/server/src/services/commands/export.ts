import type { ExportOptions, ITelegramClientAdapter } from '@tg-search/core'
import type { CommandOptions } from '../../types/apis/command'

import { ExportService } from '@tg-search/core'
import { z } from 'zod'

import { CommandHandlerBase } from '../command-handler'

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
export class ExportCommandHandler extends CommandHandlerBase {
  constructor(options?: CommandOptions) {
    super(options)
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
          this.updateStatus('running', progress, message, metadata)
        },
      })

      this.updateStatus('completed', 100, 'Export completed', {
        result,
      })
    }
    catch (error) {
      this.updateStatus('failed', 0, 'Export failed', {
        error: error as Error,
      })
    }
  }
}
