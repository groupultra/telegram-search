import type { SendMessageParams } from '@tg-search/core'
import type { App, H3Event } from 'h3'

import { findMessagesByChatId, getChatMetadataById } from '@tg-search/db'
import { createRouter, defineEventHandler, getQuery, getRouterParams, readBody } from 'h3'

import { useTelegramClient } from '../services/telegram'
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
      if (chat.type === 'user' || chat.type === 'channel') {
        items.forEach((item) => {
          item.fromName = chat.title
        })
      }
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

  // Send message
  router.post('/:id', defineEventHandler(async (event: H3Event) => {
    try {
      const client = await useTelegramClient()
      const { id } = getRouterParams(event)
      const params = await readBody<SendMessageParams>(event)
      await client.sendMessage(Number(id), params)
      return createResponse({
        message: 'Message sent successfully',
      })
    }
    catch (error) {
      return createErrorResponse(error, 'Failed to send message')
    }
  }))

  // Mount routes
  app.use('/messages', router.handler)
}
