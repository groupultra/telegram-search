import type { ITelegramClientAdapter } from '@tg-search/core'
import type { SearchResultItem } from '../../types/apis/search'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByText, findSimilarMessages, getChatsInFolder } from '@tg-search/db'
import { z } from 'zod'

import { CommandHandlerBase } from '../command-handler'

const logger = useLogger()

// Schema for search command parameters
export const searchCommandSchema = z.object({
  query: z.string(),
  folderId: z.number().optional(),
  chatId: z.number().optional(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
  useVectorSearch: z.boolean().optional().default(false),
})

/**
 * Search command handler for executing search operations across messages
 */
export class SearchCommandHandler extends CommandHandlerBase<'search'> {
  private readonly embedding: EmbeddingService

  constructor() {
    super()

    this.embedding = new EmbeddingService()
  }

  /**
   * Get target chat ID from folder if specified
   */
  private async getTargetChatId(params: z.infer<typeof searchCommandSchema>): Promise<number | undefined> {
    if (!params.folderId)
      return params.chatId

    const chats = await getChatsInFolder(params.folderId)
    if (chats.length === 0)
      throw new Error('No chats found in folder')

    logger.debug(`Searching in folder: ${params.folderId}, found ${chats.length} chats`)
    return chats.length === 1 ? chats[0].id : params.chatId
  }

  /**
   * Perform vector-based semantic search
   */
  private async vectorSearch(query: string, chatId: number | undefined, limit: number, offset: number): Promise<SearchResultItem[]> {
    const queryEmbedding = await this.embedding.generateEmbedding(query)
    const results = await findSimilarMessages(queryEmbedding, {
      chatId: chatId || 0,
      limit: limit * 2,
      offset,
    })

    return results.map(result => ({
      ...result,
      score: result.similarity,
    }))
  }

  /**
   * Perform text-based keyword search
   */
  private async textSearch(query: string, chatId: number | undefined, limit: number, offset: number): Promise<SearchResultItem[]> {
    const results = await findMessagesByText(query, {
      chatId,
      limit: limit * 2,
      offset,
    })

    return results.items.map(result => ({
      ...result,
      score: 1,
    }))
  }

  async execute(_client: ITelegramClientAdapter | null, params: z.infer<typeof searchCommandSchema>) {
    try {
      logger.debug('Executing search command')
      const startTime = Date.now()

      // Determine target chat
      const targetChatId = await this.getTargetChatId(params)

      // Perform search
      const searchResults = params.useVectorSearch
        ? await this.vectorSearch(params.query, targetChatId, params.limit, params.offset)
        : await this.textSearch(params.query, targetChatId, params.limit, params.offset)

      // Process results
      const items = searchResults
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(params.offset, params.offset + params.limit)

      this.updateStatus('completed', 100, 'Search completed', {
        command: 'search',
        duration: Date.now() - startTime,
        total: searchResults.length,
        results: items,
      })
    }
    catch (error) {
      this.updateStatus('failed', 0, 'Search failed', {
        error: error as Error,
        command: 'search',
        query: params.query,
      })
    }
  }
}
