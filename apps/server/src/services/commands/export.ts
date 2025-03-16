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
export class ExportCommandHandler extends CommandHandlerBase<'export'> {
  async execute(params: z.infer<typeof exportCommandSchema>) {
    if (!this.client) {
      throw new Error('Client is not connected')
    }

    try {
      const exportService = new ExportService(this.client)

      const result = await exportService.exportMessages({
        ...params,
        onProgress: (progress, message, metadata) => {
          this.callback?.onProgress({
            status: 'running',
            progress,
            message,
            metadata,
          })
        },
      })

      this.callback?.onComplete({
        status: 'completed',
        result,
      })
    }
    catch (error) {
      this.callback?.onError({
        status: 'failed',
        error: error as Error,
      })
    }
  }
}
