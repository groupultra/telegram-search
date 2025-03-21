import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Command, CommandOptions } from '../../types'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByText, findSimilarMessages, getChatsInFolder } from '@tg-search/db'
import { z } from 'zod'

const logger = useLogger()

export const searchCommandSchema = z.object({
  query: z.string(),
  folderId: z.number().optional(),
  chatId: z.number().optional(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
  useVectorSearch: z.boolean().optional().default(false),
})

/**
 * Search command handler for executing search operations
 */
export class SearchCommandHandler {
  private options?: CommandOptions
  private command: Command

  constructor(options?: CommandOptions) {
    this.options = options
    this.command = {
      id: crypto.randomUUID(),
      type: 'search',
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

  async execute(_client: ITelegramClientAdapter | null, params: z.infer<typeof searchCommandSchema>) {
    try {
      logger.debug('Executing search command')
      const startTime = Date.now()
      const allResults = new Map<number, any>()

      // Get target chat ID from folder if needed
      let targetChatId = params.chatId
      if (params.folderId) {
        const chats = await getChatsInFolder(params.folderId)
        if (chats.length === 0) {
          throw new Error('No chats found in folder')
        }
        if (chats.length === 1) {
          targetChatId = chats[0].id
        }
        logger.debug(`Searching in folder: ${params.folderId}, found ${chats.length} chats`)
      }

      if (params.useVectorSearch) {
        // Vector search
        const embedding = new EmbeddingService()
        const queryEmbedding = await embedding.generateEmbedding(params.query)
        const results = await findSimilarMessages(queryEmbedding, {
          chatId: targetChatId || 0,
          limit: params.limit * 2,
          offset: params.offset,
        })

        results.forEach((result) => {
          allResults.set(result.id, {
            ...result,
            score: result.similarity,
          })
        })
      }
      else {
        // Text search
        const results = await findMessagesByText(params.query, {
          chatId: targetChatId,
          limit: params.limit * 2,
          offset: params.offset,
        })

        results.items.forEach((result) => {
          allResults.set(result.id, {
            ...result,
            score: 1,
          })
        })
      }

      const items = Array.from(allResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(params.offset, params.offset + params.limit)

      this.command = {
        ...this.command,
        status: 'completed',
        progress: 100,
        message: 'Search completed',
        metadata: {
          command: 'search',
          duration: Date.now() - startTime,
          total: allResults.size,
          results: items,
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
          command: 'search',
          query: params.query,
        },
      }
      this.options?.onError(this.command, error as Error)
    }
  }
}
