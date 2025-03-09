import type { App, H3Event } from 'h3'

import { findMessagesByChatId, getAllChats } from '@tg-search/db'
import { createError, createRouter, defineEventHandler, getQuery, getRouterParams } from 'h3'

import { createResponse } from '../utils/response'

/**
 * Setup chat routes
 */
export function setupChatRoutes(app: App) {
  const router = createRouter()

  // Get all chats
  router.get('/', defineEventHandler(async () => {
    const chats = await getAllChats()
    return createResponse(chats)
  }))

  // Get messages in chat
  router.get('/:id/messages', defineEventHandler(async (event: H3Event) => {
    const { id } = getRouterParams(event)
    const { limit = '50', offset = '0' } = getQuery(event)

    // Get messages with pagination
    const messages = await findMessagesByChatId(Number(id))
    if (!messages) {
      throw createError({
        statusCode: 404,
        message: `Chat ${id} not found`,
      })
    }

    const total = messages.items.length
    const slicedMessages = messages.items
      .slice(Number(offset), Number(offset) + Number(limit))
      .map(message => ({
        id: message.id,
        chatId: message.chatId,
        type: message.type,
        content: message.content,
        mediaInfo: message.mediaInfo || null,
        createdAt: message.createdAt,
        fromId: message.fromId,
        replyToId: message.replyToId,
        forwardFromChatId: message.forwardFromChatId,
        forwardFromMessageId: message.forwardFromMessageId,
        views: message.views,
        forwards: message.forwards,
      }))

    return createResponse({
      items: slicedMessages,
      total,
    }, undefined, {
      total,
      page: Math.floor(Number(offset) / Number(limit)) + 1,
      pageSize: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    })
  }))

  // Mount routes
  app.use('/chats', router.handler)
}
