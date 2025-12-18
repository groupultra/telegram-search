import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { FetchMessageOpts } from '../types/events'

import bigInt from 'big-integer'

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
    // This works for simple text messages. For more types, use GramJS's raw constructors.
    const message = await ctx.getClient().invoke(
      new Api.messages.SendMessage({
        peer: chatId,
        message: content,
      }),
    )
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

  /**
   * Fetch unread messages for the given chatId. Uses direct GramJS requests:
   *   1. Fetch all dialogs and locate this dialog's unread state/last read id.
   *   2. Search messages for the current day, optionally filtered by opts.startTime.
   *   3. Filter as unread (msg.id > dialog.readInboxMaxId).
   */
  async function fetchUnreadMessages(
    chatId: string,
    opts?: { limit?: number, startTime?: number, accessHash?: string },
  ): Promise<Api.Message[]> {
    if (!await ctx.getClient().isUserAuthorized()) {
      logger.error('User not authorized')
      return []
    }

    try {
      // 1. Get dialog
      // TODO: need access hash
      const dialogs = await ctx.getClient().getDialogs({
        limit: 100,
        offsetPeer: chatId,
      })
      const dialog = dialogs.find(dialog => dialog.entity && dialog.entity.id && dialog.entity.id.toString() === chatId)
      if (!dialog) {
        logger.withFields({ chatId }).warn('Dialog not found for unread fetch')
        return []
      }

      // 2. Get unread count
      const unreadCount = dialog.unreadCount ?? 0
      if (unreadCount <= 0) {
        logger.withFields({ chatId }).warn('No unread messages on Telegram for this chat')
        return []
      }

      // 3. Calculate search time range: either (start of today) or as provided by opts.startTime
      let minDate = opts?.startTime
      let maxDate = undefined as undefined | number

      // If startTime not given, restrict to today
      if (!minDate) {
        const today = new Date()
        minDate = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 1000)
        maxDate = minDate + 86400
      }

      // 4. Search all messages in time range
      logger.withFields({ chatId, unreadCount, minDate }).debug('Searching for unread messages in time range')

      const searchResult = await ctx.getClient().invoke(
        new Api.messages.Search({
          peer: dialog.id,
          q: '',
          filter: new Api.InputMessagesFilterEmpty(),
          minDate,
          maxDate,
          offsetId: 0,
          addOffset: 0,
          limit: opts?.limit ? Math.min(opts.limit, unreadCount) : unreadCount,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        }),
      )

      if (searchResult instanceof Api.messages.Messages) {
        return searchResult.messages.filter(message => !(message instanceof Api.MessageEmpty)) as Api.Message[]
      }

      return []
    }
    catch (error) {
      ctx.withError(error, 'Fetch unread messages failed')
      return []
    }
  }

  /**
   * Mark all messages in the chat as read using messages.ReadHistory.
   * accessHash (for user peer) must be supplied. (You could extend to channels, etc.)
   */
  async function markAsRead(chatId: string, accessHash?: string, lastMessageId?: number) {
    if (!await ctx.getClient().isUserAuthorized()) {
      return
    }

    if (!accessHash) {
      logger.error('accessHash required for markAsRead')
      return
    }

    try {
      // 1. Build InputPeerUser
      const peer = new Api.InputPeerUser({
        userId: bigInt(chatId),
        accessHash: bigInt(accessHash),
      })

      // 2. If no lastMessageId is given, fetch dialogs to resolve to current topMessage.
      let maxId = lastMessageId
      if (!maxId) {
        const dialogsResult = await ctx.getClient().invoke(
          new Api.messages.GetDialogs({
            hash: bigInt(0),
            offsetPeer: new Api.InputPeerEmpty(),
            offsetId: 0,
            limit: 100,
            offsetDate: 0,
          }),
        )

        if (dialogsResult instanceof Api.messages.Dialogs) {
          const dialog = dialogsResult.dialogs.find(d => d instanceof Api.Dialog && d.peer instanceof Api.PeerUser && d.peer.userId.toString() === chatId)
          maxId = dialog?.topMessage
        }

        await ctx.getClient().invoke(
          new Api.messages.ReadHistory({
            peer,
            maxId: maxId ?? 0,
          }),
        )
        logger.withFields({ chatId, maxId }).debug('Marked as read')
      }
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
