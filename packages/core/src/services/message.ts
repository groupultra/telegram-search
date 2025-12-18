import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { FetchMessageOpts } from '../types/events'

import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'

export type MessageService = ReturnType<typeof createMessageService>

export function createMessageService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:message:service')

  async function* fetchMessages(
    chatId: string,
    options: Omit<FetchMessageOpts, 'chatId'>,
  ): AsyncGenerator<Api.Message> {
    if (!await ctx.getClient().isUserAuthorized()) {
      logger.error('User not authorized')
      return
    }

    const limit = options.pagination.limit
    const minId = options?.minId
    const maxId = options?.maxId

    logger.withFields({
      chatId,
      limit,
      minId,
      maxId,
    }).verbose('Fetch messages options')

    try {
      logger.withFields({ limit }).debug('Fetching messages from Telegram server')
      const messages = await ctx.getClient()
        .getMessages(chatId, {
          limit,
          minId,
          maxId,
          addOffset: options.pagination.offset, // TODO: rename this
        })

      if (messages.length === 0) {
        logger.warn('Get messages failed or returned empty data')
        return Err(new Error('Get messages failed or returned empty data'))
      }

      for (const message of messages) {
        // Skip empty messages
        if (message instanceof Api.MessageEmpty) {
          continue
        }

        yield message
      }
    }
    catch (error) {
      return Err(ctx.withError(error, 'Fetch messages failed'))
    }
  }

  async function sendMessage(chatId: string, content: string) {
    const message = await ctx.getClient()
      .invoke(new Api.messages.SendMessage({
        peer: chatId,
        message: content,
      }))

    return Ok(message)
  }

  async function fetchSpecificMessages(chatId: string, messageIds: number[]): Promise<Api.Message[]> {
    if (!await ctx.getClient().isUserAuthorized()) {
      logger.error('User not authorized')
      return []
    }

    if (messageIds.length === 0) {
      return []
    }

    try {
      logger.withFields({ chatId, count: messageIds.length }).debug('Fetching specific messages from Telegram')

      // Telegram API getMessages can accept an array of message IDs
      const messages = await ctx.getClient().getMessages(chatId, {
        ids: messageIds,
      })

      // Filter out empty messages
      return messages.filter((message: Api.Message) => !(message instanceof Api.MessageEmpty))
    }
    catch (error) {
      logger.withError(ctx.withError(error, 'Fetch specific messages failed') as Error).error('Failed to fetch specific messages')
      return []
    }
  }

  async function fetchUnreadMessages(chatId: string): Promise<Api.Message[]> {
    if (!await ctx.getClient().isUserAuthorized()) {
      logger.error('User not authorized')
      return []
    }

    try {
      const dialogs = await ctx.getClient().getDialogs()
      const dialog = dialogs.find(d => d.entity?.id?.toString() === chatId)

      if (!dialog) {
        logger.withFields({ chatId }).warn('Dialog not found for unread fetch')
        return []
      }

      const unreadCount = dialog.unreadCount
      if (unreadCount <= 0) {
        return []
      }

      // Limit to 50 for summary context
      const limit = Math.min(unreadCount, 50)

      logger.withFields({ chatId, unreadCount, limit }).debug('Fetching unread messages')

      const messages = await ctx.getClient().getMessages(chatId, {
        limit,
      })

      return messages.filter((m: any) => !(m instanceof Api.MessageEmpty))
    }
    catch (error) {
      ctx.withError(error, 'Fetch unread messages failed')
      return []
    }
  }

  async function markAsRead(chatId: string) {
    if (!await ctx.getClient().isUserAuthorized()) {
      return
    }
    try {
      await ctx.getClient().markAsRead(chatId)
    }
    catch (error) {
      ctx.withError(error, 'Mark as read failed')
    }
  }

  return {
    fetchMessages,
    sendMessage,
    fetchSpecificMessages,
    fetchUnreadMessages,
    markAsRead,
  }
}
