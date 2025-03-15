import type { ITelegramClientAdapter } from '@tg-search/core'
import type { CommandOptions } from '../../types'

import { useLogger } from '@tg-search/common'
import { ChatsSyncServices } from '@tg-search/core'
import { z } from 'zod'

import { CommandHandlerBase } from '../command-handler'

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
export class SyncChatsCommandHandler extends CommandHandlerBase {
  constructor(options?: CommandOptions) {
    super(options)
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
            this.updateStatus('waiting', progress, message, {
              ...metadata,
              waitSeconds: metadata.waitSeconds,
              resumeTime: new Date(Date.now() + metadata.waitSeconds * 1000).toISOString(),
            })
          }
          else {
            this.updateStatus('running', progress, message, {
              ...metadata,
              command: 'sync',
              chatIds: params.chatIds,
              type: params.type,
            })
          }
        },
      })

      this.updateStatus('completed', 100, '同步完成', {
        command: 'sync',
        chatIds: params.chatIds,
        type: params.type,
      })
    }
    catch (error) {
      this.updateStatus('failed', 0, '同步失败', {
        error: error as Error,
        command: 'sync',
        chatIds: params.chatIds,
        type: params.type,
      })
    }
  }
}
