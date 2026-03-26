import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { FetchMessageOpts } from '../types/events'
import type { EntityService } from './entity'

import { withSpan } from '@tg-search/observability'
import { Ok } from '@unbird/result'
import { Api } from 'telegram'

export type MessageService = ReturnType<typeof createMessageService>

const MAX_UNREAD_MESSAGES_LIMIT = 1000
const MAX_SUMMARY_MESSAGES_LIMIT = 1000
const SUMMARY_FETCH_BATCH_SIZE = 100

export function createMessageService(ctx: CoreContext, logger: Logger, entityService: EntityService) {
  logger = logger.withContext('core:message:service')

  function isValidApiMessage(message: Api.TypeMessage): message is Api.Message {
    return message instanceof Api.Message && !(message instanceof Api.MessageEmpty)
  }

  async function* fetchMessages(
    chatId: string,
    options: Omit<FetchMessageOpts, 'chatId'>,
  ): AsyncGenerator<Api.Message> {
    if (!await ctx.getClient().isUserAuthorized()) {
      throw new Error('User not authorized')
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

    logger.withFields({ limit }).debug('Fetching messages from Telegram server')
    const peer = await entityService.getInputPeer(chatId)
    const messages = await ctx.getClient().getMessages(peer, {
      limit,
      minId,
      maxId,
      addOffset: options.pagination.offset,
    })

    if (messages.length === 0) {
      logger.warn('Get messages returned empty data')
      return
    }

    for (const message of messages) {
      if (message instanceof Api.MessageEmpty) {
        continue
      }
      yield message
    }
  }

  async function sendMessage(chatId: string, content: string) {
    return withSpan('core:message:service:sendMessage', async () => {
      // This works for simple text messages. For more types, use GramJS's raw constructors.
      const peer = await entityService.getInputPeer(chatId)
      const message = await ctx.getClient().invoke(
        new Api.messages.SendMessage({
          peer,
          message: content,
        }),
      )
      return Ok(message)
    })
  }

  async function fetchSpecificMessages(chatId: string, messageIds: number[]): Promise<Api.Message[]> {
    return withSpan('core:message:service:fetchSpecificMessages', async () => {
      if (!await ctx.getClient().isUserAuthorized()) {
        throw new Error('User not authorized')
      }

      if (messageIds.length === 0) {
        return []
      }

      logger.withFields({ chatId, count: messageIds.length }).debug('Fetching specific messages from Telegram')

      const peer = await entityService.getInputPeer(chatId)
      const messages = await ctx.getClient().getMessages(peer, {
        ids: messageIds,
      })

      return messages.filter((message: Api.Message) => !(message instanceof Api.MessageEmpty))
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
        throw new Error('User not authorized')
      }

      const peer = await entityService.getInputPeer(chatId)

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

      const limit = Math.min(opts?.limit ?? MAX_UNREAD_MESSAGES_LIMIT, MAX_UNREAD_MESSAGES_LIMIT, unreadCount)

      logger.withFields({
        chatId,
        unreadCount,
        readInboxMaxId,
        topMessage,
        limit,
      }).debug('Fetching unread messages from top via getMessages')

      const messages = await ctx.getClient().getMessages(peer, {
        limit,
      }) as Api.Message[]

      if (messages.length === 0) {
        return []
      }

      const startTime = opts?.startTime
      const validMessages = messages.filter(message => !(message instanceof Api.MessageEmpty))
      const filteredByReadBoundary = validMessages.filter(m => m.id > readInboxMaxId)
      const filteredByStartTime = startTime !== undefined
        ? filteredByReadBoundary.filter(m => m.date >= startTime)
        : filteredByReadBoundary

      logger.withFields({
        chatId,
        returned: validMessages.length,
        newerThanBoundary: filteredByReadBoundary.length,
        newerThanStartTime: filteredByStartTime.length,
        latestId: validMessages[0]?.id,
        oldestId: validMessages[validMessages.length - 1]?.id,
      }).debug('Unread messages fetch result')

      if (filteredByStartTime.length > 0)
        return filteredByStartTime
      if (filteredByReadBoundary.length > 0)
        return filteredByReadBoundary
      return validMessages
    })
  }

  /**
   * Fetch recent messages within a unix time range (seconds).
   * Returned list is in Telegram default order (newest first).
   *
   * NOTE: Telegram doesn't support "get messages by time" directly.
   * We paginate backward from the newest message until we cross startTime or reach limit.
   */
  async function fetchRecentMessagesByTimeRange(
    chatId: string,
    opts: { startTime: number, endTime?: number, limit?: number },
  ): Promise<Api.Message[]> {
    return withSpan('core:message:service:fetchRecentMessagesByTimeRange', async () => {
      if (!await ctx.getClient().isUserAuthorized()) {
        logger.error('User not authorized')
        return []
      }

      const startTime = opts.startTime
      const endTime = opts.endTime
      const limit = Math.min(opts.limit ?? MAX_SUMMARY_MESSAGES_LIMIT, MAX_SUMMARY_MESSAGES_LIMIT)
      const batchSize = Math.min(SUMMARY_FETCH_BATCH_SIZE, limit)

      const peer = await entityService.getInputPeer(chatId)

      const collected: Api.Message[] = []
      let maxId: number | undefined
      let reachedStartBoundary = false

      while (collected.length < limit && !reachedStartBoundary) {
        const rawBatch = await ctx.getClient().getMessages(peer, {
          limit: batchSize,
          maxId,
        })

        const batch = rawBatch.filter(isValidApiMessage)
        if (batch.length === 0)
          break

        for (const message of batch) {
          // Messages are newest -> oldest in each batch.
          if (endTime && message.date > endTime)
            continue

          if (message.date < startTime) {
            reachedStartBoundary = true
            break
          }

          collected.push(message)
          if (collected.length >= limit)
            break
        }

        const oldest = batch[batch.length - 1]
        // Prevent infinite loops when Telegram returns stable windows.
        maxId = Math.max(0, oldest.id - 1)
      }

      logger.withFields({
        chatId,
        startTime,
        endTime,
        limit,
        returned: collected.length,
      }).debug('Fetched recent messages by time range')

      return collected
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
        const peer = await entityService.getInputPeer(chatId)

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
    fetchRecentMessagesByTimeRange,
    markAsRead,
  }
}
