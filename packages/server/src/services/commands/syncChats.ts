import type { ITelegramClientAdapter } from '@tg-search/core'
import type { CommandOptions } from '../../types'
import type { WebSocketPeer } from '../../utils/ws'

import { useLogger } from '@tg-search/common'
import { ChatsSyncServices } from '@tg-search/core'
import { z } from 'zod'

import { BaseCommandHandler } from '../command-manager'

const logger = useLogger()

export const syncChatsCommandSchema = z.object({
  chatIds: z.array(z.number()),
  type: z.enum(['metadata', 'messages']).optional(),
  priorities: z.record(z.number(), z.number()).optional(),
  options: z.record(z.number(), z.record(z.string(), z.unknown())).optional(),
})

/**
 * Sync chats command handler with WebSocket support
 */
export class SyncChatsCommandHandler extends BaseCommandHandler {
  constructor(peer: WebSocketPeer, options?: CommandOptions) {
    super(peer, options)
    this.command.type = 'sync'
  }

  async execute(client: ITelegramClientAdapter, params: z.infer<typeof syncChatsCommandSchema>) {
    try {
      logger.debug('Executing sync command')
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

      this.handleComplete({
        command: 'sync',
        chatIds: params.chatIds,
        type: params.type,
      })
    }
    catch (error) {
      logger.error('Sync command failed', { error })
      this.handleError(error as Error)
      throw error
    }
  }
}
