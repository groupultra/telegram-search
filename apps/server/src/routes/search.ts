import type { App, H3Event } from 'h3'
import type { SearchCompleteResponse, SearchRequest, SearchResultItem } from '../types'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByText, findSimilarMessages, getChatsInFolder } from '@tg-search/db'
import { createRouter, defineEventHandler, readBody } from 'h3'

import { SSEHandler } from '../services/sse-handler'
import { createSSEResponse } from '../utils/sse'

const logger = useLogger()

/**
 * Setup search routes
 */
export function setupSearchRoutes(app: App) {
  const router = createRouter()

  // Search route
  router.post('/', defineEventHandler(async (event: H3Event) => {
    const body = await readBody<SearchRequest>(event)
    const { query, folderId, chatId, limit = 20, offset = 0, useVectorSearch = false } = body
    const startTime = Date.now()

    // Log search request
    return createSSEResponse(async (controller) => {
      const handler = new SSEHandler<SearchResultItem[]>(controller)

      try {
        // Get chats to search in
        let targetChatId = chatId
        if (folderId) {
          // Search in folder
          const chats = await getChatsInFolder(folderId)
          if (chats.length === 0) {
            throw new Error('No chats found in folder')
          }
          if (chats.length === 1) {
            targetChatId = chats[0].id
          }

          logger.debug(`Searching in folder: ${folderId}, found ${chats.length} chats`)
        }

        const allResults = new Map<number, SearchResultItem>()

        // Function to send partial results
        const sendPartialResults = () => {
          const items = Array.from(allResults.values())
            .sort((a, b) => b.score - a.score)
            .slice(offset, offset + limit)

          handler.sendProgress(items)
        }

        if (useVectorSearch) {
          // Vector search
          const embedding = new EmbeddingService()
          const queryEmbedding = await embedding.generateEmbedding(query)
          const results = await findSimilarMessages(queryEmbedding, {
            chatId: targetChatId || 0,
            limit: limit * 2,
            offset,
          })

          results.forEach((result) => {
            allResults.set(result.id, {
              ...result,
              score: result.similarity,
            } as SearchResultItem)
          })
          sendPartialResults()
        }
        else {
          // Text search
          const results = await findMessagesByText(query, {
            chatId: targetChatId,
            limit: limit * 2,
            offset,
          })

          results.items.forEach((result) => {
            allResults.set(result.id, {
              ...result,
              score: 1,
            } as SearchResultItem)
          })
          sendPartialResults()
        }

        handler.complete({
          duration: Date.now() - startTime,
          total: allResults.size,
        } as SearchCompleteResponse)
      }
      catch (error) {
        logger.withError(error).error('Search failed')
        handler.error(error as Error)
      }
    })
  }))

  // Mount routes
  app.use('/search', router.handler)
}
