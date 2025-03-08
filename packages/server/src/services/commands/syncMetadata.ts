import type { ITelegramClientAdapter, MetadataSyncOptions } from '@tg-search/core'
import type { CommandOptions } from '../../types'
import type { WebSocketPeer } from '../../utils/ws'

import { useLogger } from '@tg-search/common'
import { MetadataSyncServices } from '@tg-search/core'
import { z } from 'zod'

import { BaseCommandHandler } from '../command-manager'

const logger = useLogger()

export const syncMetadataCommandSchema = z.object({})

/**
 * Sync metadata command handler with WebSocket support
 */
export class SyncMetadataCommandHandler extends BaseCommandHandler {
  constructor(peer: WebSocketPeer, options?: CommandOptions) {
    super(peer, options)
    this.command.type = 'sync'
  }

  async execute(client: ITelegramClientAdapter, params: MetadataSyncOptions) {
    try {
      logger.debug('Executing metadata sync command')
      const syncService = new MetadataSyncServices(client)
      const result = await syncService.syncChats({
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
      logger.error('Metadata sync command failed', { error })
      this.handleError(error as Error)
      throw error
    }
  }
}
