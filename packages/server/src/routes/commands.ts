import type { App, H3Event } from 'h3'

import { useLogger } from '@tg-search/common'
import { createRouter, defineEventHandler, readBody } from 'h3'

import { exportCommandSchema } from '../services/commands/export'
import { CommandManager } from '../services/commands/manager'
import { syncChatsCommandSchema } from '../services/commands/syncChats'
import { syncMetadataCommandSchema } from '../services/commands/syncMetadata'
import { useTelegramClient } from '../services/telegram'
import { createSSEResponse } from '../utils/sse'

const logger = useLogger()

/**
 * Setup command routes
 */
export function setupCommandRoutes(app: App) {
  const router = createRouter()
  const commandManager = new CommandManager()
  router.post('/sync', defineEventHandler(async (event: H3Event) => {
    const body = await readBody(event)
    const vaildatedBody = syncMetadataCommandSchema.parse(body)
    logger.withFields(vaildatedBody).debug('Sync metadata request received')

    const client = await useTelegramClient()
    if (!await client.isConnected()) {
      await client.connect()
    }

    const params = { ...vaildatedBody }
    return createSSEResponse(async (controller) => {
      await commandManager.executeCommand('syncMetadata', client, params, controller)
    })
  }))

  // Add multi-sync route
  router.post('/sync-chats', defineEventHandler(async (event: H3Event) => {
    const body = await readBody(event)
    const vaildatedBody = syncChatsCommandSchema.parse(body)
    logger.withFields(vaildatedBody).debug('Sync chats request received')

    const client = await useTelegramClient()
    if (!await client.isConnected()) {
      await client.connect()
    }

    const params = { ...vaildatedBody }
    return createSSEResponse(async (controller) => {
      await commandManager.executeCommand('syncChats', client, params, controller)
    })
  }))

  router.post('/export', defineEventHandler(async (event: H3Event) => {
    const body = await readBody(event)
    const validatedBody = exportCommandSchema.parse(body)

    logger.withFields(validatedBody).debug('Export request received')

    const client = await useTelegramClient()
    if (!await client.isConnected()) {
      await client.connect()
    }

    // Get chat metadata
    const chats = await client.getDialogs()
    const chat = chats.find(c => c.id === validatedBody.chatId)
    if (!chat) {
      throw new Error(`Chat ${validatedBody.chatId} not found`)
    }

    // Parse params
    const params = {
      ...validatedBody,
      startTime: validatedBody.startTime ? new Date(validatedBody.startTime) : undefined,
      endTime: validatedBody.endTime ? new Date(validatedBody.endTime) : undefined,
      chatMetadata: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
      },
    }

    // Execute export with SSE
    return createSSEResponse(async (controller) => {
      await commandManager.executeCommand('export', client, params, controller)
    })
  }))

  // Mount routes
  app.use('/commands', router.handler)
}
