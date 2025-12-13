import type { CoreContext } from '../context'
import type { Models } from '../models'
import type { DBRetrievalMessages } from '../models/utils/message'
import type { CoreDialog } from '../types/dialog'
import type { CoreMessage } from '../types/message'

import { useLogger } from '@guiiai/logg'

import { convertToCoreRetrievalMessages } from '../models/utils/message'
import { embedContents } from '../utils/embed'

/**
 * Check if a message has no media attached
 */
function hasNoMedia(message: CoreMessage): boolean {
  return !message.media || message.media.length === 0
}

export function registerStorageEventHandlers(ctx: CoreContext, dbModels: Models) {
  const logger = useLogger('core:storage:event')

  ctx.emitter.on('storage:fetch:messages', async ({ chatId, pagination }) => {
    logger.withFields({ chatId, pagination }).verbose('Fetching messages')

    const accountId = ctx.getCurrentAccountId()
    const hasAccess = (await dbModels.chatModels.isChatAccessibleByAccount(ctx.getDB(), accountId, chatId)).expect('Failed to check chat access')

    if (!hasAccess) {
      ctx.withError('Unauthorized chat access', 'Account does not have access to requested chat messages')
      return
    }

    const messages = (await dbModels.chatMessageModels.fetchMessagesWithPhotos(ctx.getDB(), dbModels.photoModels, accountId, chatId, pagination)).unwrap()
    ctx.emitter.emit('storage:messages', { messages })
  })

  ctx.emitter.on('storage:fetch:message-context', async ({ chatId, messageId, before = 20, after = 20 }) => {
    const safeBefore = Math.max(0, before)
    const safeAfter = Math.max(0, after)

    logger.withFields({ chatId, messageId, before: safeBefore, after: safeAfter }).verbose('Fetching message context')

    const accountId = ctx.getCurrentAccountId()
    const hasAccess = (await dbModels.chatModels.isChatAccessibleByAccount(ctx.getDB(), accountId, chatId)).expect('Failed to check chat access')

    if (!hasAccess) {
      ctx.withError('Unauthorized chat access', 'Account does not have access to requested message context')
      return
    }

    const messages = (await dbModels.chatMessageModels.fetchMessageContextWithPhotos(
      ctx.getDB(),
      dbModels.photoModels,
      accountId,
      { chatId, messageId, before: safeBefore, after: safeAfter },
    )).unwrap()

    ctx.emitter.emit('storage:messages:context', { chatId, messageId, messages })

    // After emitting the initial messages, identify messages that might be missing media
    // and trigger a fetch from Telegram to download them
    // We only fetch messages that have no media in the database, as media is optional
    // The media resolver will check if media already exists before downloading
    const messageIdsToFetch = messages
      .filter(hasNoMedia)
      .map(m => Number.parseInt(m.platformMessageId))
      .filter(id => !Number.isNaN(id))

    if (messageIdsToFetch.length > 0) {
      logger.withFields({ messageIds: messageIdsToFetch.length }).verbose('Fetching messages from Telegram to check for missing media')

      // Fetch these specific messages from Telegram which will download any missing media
      // This is done asynchronously and will update the messages once media is downloaded
      ctx.emitter.emit('message:fetch:specific', {
        chatId,
        messageIds: messageIdsToFetch,
      })
    }
  })

  ctx.emitter.on('storage:record:messages', async ({ messages }) => {
    const accountId = ctx.getCurrentAccountId()

    await dbModels.chatMessageModels.recordMessages(ctx.getDB(), accountId, messages)

    logger.withFields({ messages: messages.length, accountId }).verbose('Messages recorded')
  })

  ctx.emitter.on('storage:fetch:dialogs', async (data) => {
    logger.verbose('Fetching dialogs')

    const accountId = data?.accountId || ctx.getCurrentAccountId()

    const dbChats = (await dbModels.chatModels.fetchChatsByAccountId(ctx.getDB(), accountId))?.unwrap()
    const chatsMessageStats = (await dbModels.chatMessageStatsModels.getChatMessagesStats(ctx.getDB(), accountId))?.unwrap()

    logger.withFields({ accountId, dbChatsSize: dbChats.length, chatsMessageStatsSize: chatsMessageStats.length }).verbose('Fetched dialogs for account')

    const dialogs = dbChats.map((chat) => {
      const chatMessageStats = chatsMessageStats.find(stats => stats.chat_id === chat.chat_id)
      return {
        id: Number(chat.chat_id),
        name: chat.chat_name,
        type: chat.chat_type,
        messageCount: chatMessageStats?.message_count,
      } satisfies CoreDialog
    })

    ctx.emitter.emit('storage:dialogs', { dialogs })
  })

  ctx.emitter.on('storage:record:dialogs', async ({ dialogs, accountId }) => {
    logger.withFields({
      size: dialogs.length,
      users: dialogs.filter(d => d.type === 'user').length,
      groups: dialogs.filter(d => d.type === 'group').length,
      channels: dialogs.filter(d => d.type === 'channel').length,
      accountId,
    }).verbose('Recording dialogs')

    if (dialogs.length === 0) {
      logger.warn('No dialogs to record, skipping database write')
      return
    }

    const result = await dbModels.chatModels.recordChats(ctx.getDB(), dialogs, accountId)
    logger.withFields({ recorded: result.length }).verbose('Successfully recorded dialogs')
  })

  ctx.emitter.on('storage:search:messages', async (params) => {
    logger.withFields({ params }).verbose('Searching messages')

    const accountId = ctx.getCurrentAccountId()

    if (params.content.length === 0) {
      return
    }

    if (params.chatId) {
      const hasAccess = (await dbModels.chatModels.isChatAccessibleByAccount(ctx.getDB(), accountId, params.chatId)).expect('Failed to check chat access')

      if (!hasAccess) {
        ctx.withError('Unauthorized chat access', 'Account does not have access to requested chat messages')
        return
      }
    }

    // Prepare filters from params
    const filters = {
      fromUserId: params.fromUserId,
      timeRange: params.timeRange,
    }

    const embeddingSettings = (await ctx.getAccountSettings()).embedding
    const embeddingDimension = embeddingSettings.dimension
    let dbMessages: DBRetrievalMessages[] = []
    if (params.useVector) {
      let embedding: number[] = []
      const embeddingResult = (await embedContents([params.content], embeddingSettings)).orUndefined()
      if (embeddingResult)
        embedding = embeddingResult.embeddings[0]

      dbMessages = (await dbModels.chatMessageModels.retrieveMessages(ctx.getDB(), accountId, params.chatId, embeddingDimension, { embedding, text: params.content }, params.pagination, filters)).expect('Failed to retrieve messages')
    }
    else {
      dbMessages = (await dbModels.chatMessageModels.retrieveMessages(ctx.getDB(), accountId, params.chatId, embeddingDimension, { text: params.content }, params.pagination, filters)).expect('Failed to retrieve messages')
    }

    logger.withFields({ messages: dbMessages.length }).verbose('Retrieved messages')
    logger.withFields(dbMessages).debug('Retrieved messages')

    const coreMessages = convertToCoreRetrievalMessages(dbMessages)

    ctx.emitter.emit('storage:search:messages:data', { messages: coreMessages })
  })
}
