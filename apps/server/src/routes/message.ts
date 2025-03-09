import type { App, H3Event } from 'h3'

import { findMessagesByChatId, getChatMetadataById } from '@tg-search/db'
import { createRouter, defineEventHandler, getQuery, getRouterParams } from 'h3'

import { createErrorResponse, createResponse } from '../utils/response'

/**
 * Setup message routes
 */
export function setupMessageRoutes(app: App) {
  const router = createRouter()

  // Get messages in chat
  router.get('/:id', defineEventHandler(async (event: H3Event) => {
    try {
      const { id } = getRouterParams(event)
      const { limit = '50', offset = '0' } = getQuery(event)
      const chat = await getChatMetadataById(Number(id))
      const { items, total } = await findMessagesByChatId(Number(id), {
        limit: Number(limit),
        offset: Number(offset),
      })
      return createResponse({
        items,
        chat,
        total,
      }, undefined, {
        total,
        page: Math.floor(Number(offset) / Number(limit)) + 1,
        pageSize: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      })
    }
    catch (error) {
      return createErrorResponse(error, 'Failed to get messages')
    }
  }))

  // Mount routes
  app.use('/messages', router.handler)
}
