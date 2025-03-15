import type { ITelegramClientAdapter, MetadataSyncOptions } from '@tg-search/core'
import type { CommandOptions } from '../../types'

import { useLogger } from '@tg-search/common'
import { MetadataSyncServices } from '@tg-search/core'
import { z } from 'zod'

import { CommandHandlerBase } from '../command-handler'

const logger = useLogger()

export const syncMetadataCommandSchema = z.object({})

/**
 * Sync metadata command handler
 */
export class SyncMetadataCommandHandler extends CommandHandlerBase {
  constructor(options?: CommandOptions) {
    super(options)
  }

  async execute(client: ITelegramClientAdapter | null, params: MetadataSyncOptions) {
    if (!client) {
      throw new Error('Client is not connected')
    }

    try {
      logger.debug('执行同步命令')
      const syncService = new MetadataSyncServices(client)
      const result = await syncService.syncChats({
        ...params,
        onProgress: (progress, message, metadata) => {
          this.updateStatus('running', progress, message, metadata)
        },
      })
      this.updateStatus('completed', 100, '同步完成', result)
    }
    catch (error) {
      this.updateStatus('failed', 0, '同步失败', { error: error as Error })
    }
  }
}
