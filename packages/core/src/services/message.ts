import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { FetchMessageOpts } from '../types/events'

import { withSpan } from '@tg-search/observability'
import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'

export type MessageService = ReturnType<typeof createMessageService>

const MAX_UNREAD_MESSAGES_LIMIT = 1000

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
      const messages = await ctx.getClient().getMessages(chatId, {
        limit,
        minId,
        maxId,
        addOffset: options.pagination.offset,
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
    return withSpan('core:message:service:sendMessage', async () => {
      // This works for simple text messages. For more types, use GramJS's raw constructors.
      const message = await ctx.getClient().invoke(
        new Api.messages.SendMessage({
          peer: chatId,
          message: content,
        }),
      )
      return Ok(message)
    })
  }

  async function fetchSpecificMessages(chatId: string, messageIds: number[]): Promise<Api.Message[]> {
    return withSpan('core:message:service:fetchSpecificMessages', async () => {
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
    })
  }

  /**
   * Fetch unread messages for the given chatId. Uses direct GramJS requests:
   *   1. Resolve the peer and fetch dialog metadata to locate the read inbox boundary (readInboxMaxId).
   *   2. Fetch history starting from the read boundary using messages.GetHistory.
   */
  async function fetchUnreadMessages(
    chatId: string,
    opts?: { limit?: number, startTime?: number, accessHash?: string },
  ): Promise<Api.Message[]> {
    return withSpan('core:message:service:fetchUnreadMessages', async () => {
      if (!await ctx.getClient().isUserAuthorized()) {
        logger.error('User not authorized')
        return []
      }

      try {
        // 1. Resolve Peer
        const peer = await ctx.getClient().getInputEntity(chatId)

        // 2. Get dialog metadata to locate read inbox boundary
        const peerDialogs = await ctx.getClient().invoke(
          new Api.messages.GetPeerDialogs({
            peers: [new Api.InputDialogPeer({ peer })],
          }),
        )

        if (!(peerDialogs instanceof Api.messages.PeerDialogs) || peerDialogs.dialogs.length === 0) {
          logger.withFields({ chatId }).warn('Dialog not found for unread fetch')
          return []
        }

        const dialog = peerDialogs.dialogs[0]
        if (!(dialog instanceof Api.Dialog)) {
          return []
        }

        const readInboxMaxId = dialog.readInboxMaxId
        const unreadCount = dialog.unreadCount
        const topMessage = dialog.topMessage

        if (unreadCount <= 0) {
          logger.withFields({ chatId }).debug('No unread messages on Telegram for this chat')
          return []
        }

        // 3. Pull history
        // We use client.getMessages which handles pagination automatically to reach the 'limit'.
        const limit = Math.min(opts?.limit || MAX_UNREAD_MESSAGES_LIMIT, unreadCount)

        logger.withFields({
          chatId,
          unreadCount,
          readInboxMaxId,
          topMessage,
          limit,
        }).debug('Fetching unread messages from top via getMessages')

        const messages = await ctx.getClient().getMessages(peer, {
          limit,
          // We don't strictly use minId in the request to avoid issues where readInboxMaxId is de-synced,
          // instead we fetch the top N messages and filter locally.
        }) as Api.Message[]

        if (messages && messages.length > 0) {
          // Filter out empty messages (already mostly handled by getMessages but to be safe)
          const validMessages = messages.filter(message => !(message instanceof Api.MessageEmpty))

          // Optional: Filter by readInboxMaxId locally if we want to be strict,
          // but often unreadCount is what the user expects to see.
          const filtered = validMessages.filter(m => m.id > readInboxMaxId)

          logger.withFields({
            chatId,
            returned: validMessages.length,
            newerThanBoundary: filtered.length,
            latestId: validMessages[0]?.id,
            oldestId: validMessages[validMessages.length - 1]?.id,
          }).debug('Unread messages fetch result')

          // If local filtering results in too few messages compared to unreadCount,
          // we trust unreadCount and return the full batch.
          return filtered.length > 0 ? filtered : validMessages
        }

        return []
      }
      catch (error) {
        ctx.withError(error, 'Fetch unread messages failed')
        return []
      }
    })
  }

  /**
   * Mark all messages in the chat as read.
   * Resolves the peer and its top message ID automatically if not provided.
   */
  async function markAsRead(chatId: string, _accessHash?: string, lastMessageId?: number) {
    return withSpan('core:message:service:markAsRead', async () => {
      if (!await ctx.getClient().isUserAuthorized()) {
        return
      }

      try {
        // 1. Resolve Peer
        const peer = await ctx.getClient().getInputEntity(chatId)

        // 2. Resolve maxId (the latest message ID to mark as read)
        let maxId = lastMessageId
        if (!maxId) {
          const peerDialogs = await ctx.getClient().invoke(
            new Api.messages.GetPeerDialogs({
              peers: [new Api.InputDialogPeer({ peer })],
            }),
          )

          if (peerDialogs instanceof Api.messages.PeerDialogs && peerDialogs.dialogs.length > 0) {
            const dialog = peerDialogs.dialogs[0]
            if (dialog instanceof Api.Dialog) {
              maxId = dialog.topMessage
            }
          }
        }

        if (!maxId) {
          logger.withFields({ chatId }).warn('Could not determine top message for markAsRead')
          return
        }

        // 3. Invoke appropriate ReadHistory call
        if (peer instanceof Api.InputPeerChannel) {
          await ctx.getClient().invoke(
            new Api.channels.ReadHistory({
              channel: peer,
              maxId,
            }),
          )
        }
        else {
          await ctx.getClient().invoke(
            new Api.messages.ReadHistory({
              peer,
              maxId,
            }),
          )
        }

        logger.withFields({ chatId, maxId }).debug('Marked as read')
      }
      catch (error) {
        ctx.withError(error, 'Mark as read failed')
      }
    })
  }

  return {
    fetchMessages,
    sendMessage,
    fetchSpecificMessages,
    fetchUnreadMessages,
    markAsRead,
  }
}
