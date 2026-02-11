import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { Models } from '../models'
import type { DBRetrievalMessages } from '../models/utils/message'
import type { CoreDialog } from '../types/dialog'
import type { CoreMessage } from '../types/message'

import { convertToCoreRetrievalMessages } from '../models/utils/message'
import { CoreEventType } from '../types/events'
import { embedContents } from '../utils/embed'

/**
 * Check if a message has no media attached
 */
function hasNoMedia(message: CoreMessage): boolean {
  return !message.media || message.media.length === 0
}

export function registerStorageEventHandlers(ctx: CoreContext, logger: Logger, dbModels: Models) {
  logger = logger.withContext('core:storage:event')

  ctx.emitter.on(CoreEventType.StorageFetchMessages, async ({ chatId, pagination }) => {
    logger.withFields({ chatId, pagination }).verbose('Fetching messages')

    const accountId = ctx.getCurrentAccountId()
    const hasAccess = (await dbModels.chatModels.isChatAccessibleByAccount(ctx.getDB(), accountId, chatId)).expect('Failed to check chat access')

    if (!hasAccess) {
      ctx.withError('Unauthorized chat access', 'Account does not have access to requested chat messages')
      return
    }

    const messages = (await dbModels.chatMessageModels.fetchMessagesWithPhotos(ctx.getDB(), dbModels.photoModels, accountId, chatId, pagination)).unwrap()
    ctx.emitter.emit(CoreEventType.StorageMessages, { messages })
  })

  ctx.emitter.on(CoreEventType.StorageFetchMessageContext, async ({ chatId, messageId, before = 20, after = 20 }) => {
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

    ctx.emitter.emit(CoreEventType.StorageMessagesContext, { chatId, messageId, messages })

    // After emitting the initial messages, identify messages that might be missing media
    // and trigger a fetch from Telegram to download them
    // We only fetch messages that have no media in the database, as media is optional
    // The media resolver will check if media already exists before downloading
    const messageIdsToFetch = messages
      .filter(hasNoMedia)
      .map(m => Number.parseInt(m.platformMessageId))
      .filter(id => !Number.isNaN(id))

    if (messageIdsToFetch.length > 0) {
      logger.withFields({ chatId, count: messageIdsToFetch.length }).verbose('Fetching messages from Telegram to check for missing media')

      // Fetch these specific messages from Telegram which will download any missing media
      // This is done asynchronously and will update the messages once media is downloaded
      ctx.emitter.emit(CoreEventType.MessageFetchSpecific, {
        chatId,
        messageIds: messageIdsToFetch,
      })
    }
  })

  ctx.emitter.on(CoreEventType.StorageRecordMessages, async ({ messages }) => {
    const accountId = ctx.getCurrentAccountId()

    await dbModels.chatMessageModels.recordMessages(ctx.getDB(), accountId, messages)

    logger.withFields({ count: messages.length }).verbose('Messages recorded')
  })

  ctx.emitter.on(CoreEventType.StorageFetchDialogs, async (data) => {
    logger.verbose('Fetching dialogs')

    const accountId = data?.accountId || ctx.getCurrentAccountId()

    const dbChats = (await dbModels.chatModels.fetchChatsByAccountId(ctx.getDB(), accountId))?.unwrap()
    const chatsMessageStats = (await dbModels.chatMessageStatsModels.getChatMessagesStats(ctx.getDB(), accountId))?.unwrap()

    logger.withFields({ count: dbChats.length, chatsMessageStatsCount: chatsMessageStats.length }).verbose('Fetched dialogs for account')

    const dialogs = dbChats.map((chat) => {
      const chatMessageStats = chatsMessageStats.find(stats => stats.chat_id === chat.chat_id)
      return {
        id: Number(chat.chat_id),
        name: chat.chat_name,
        type: chat.chat_type,
        isContact: chat.is_contact ?? undefined,
        messageCount: chatMessageStats?.message_count,
        lastMessageDate: chat.dialog_date ? new Date(chat.dialog_date) : undefined,
        pinned: !!chat.is_pinned,
        folderIds: chat.folder_ids ?? [],
        accessHash: chat.access_hash ?? undefined,
      } satisfies CoreDialog
    })

    ctx.emitter.emit(CoreEventType.StorageDialogs, { dialogs })
  })

  ctx.emitter.on(CoreEventType.StorageRecordDialogs, async ({ dialogs, accountId }) => {
    logger.withFields({
      size: dialogs.length,
      users: dialogs.filter(d => d.type === 'user').length,
      groups: dialogs.filter(d => d.type === 'group').length,
      channels: dialogs.filter(d => d.type === 'channel').length,
    }).verbose('Recording dialogs')

    if (dialogs.length === 0) {
      logger.warn('No dialogs to record, skipping database write')
      return
    }

    const result = await dbModels.chatModels.recordChats(ctx.getDB(), dialogs, accountId)
    logger.withFields({ count: result.length }).verbose('Successfully recorded dialogs')
  })

  ctx.emitter.on(CoreEventType.StorageRecordChatFolders, async ({ folders, accountId }) => {
    logger.withFields({ count: folders.length }).verbose('Recording chat folders')

    const db = ctx.getDB()

    // Update folder mapping in account_joined_chats
    await dbModels.chatFolderModels.updateChatFolders(db, accountId, folders)
    logger.verbose('Successfully updated chat folders mapping')

    // Store folder metadata in account_chat_folders table
    await dbModels.chatFolderModels.upsertFolders(db, accountId, folders)
    logger.verbose('Successfully stored folder metadata')
  })

  ctx.emitter.on(CoreEventType.StorageSearchMessages, async (params) => {
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
      chatIds: params.chatIds,
    }

    const embeddingSettings = (await ctx.getAccountSettings()).embedding
    const embeddingDimension = embeddingSettings.dimension
    let dbMessages: DBRetrievalMessages[] = []
    if (params.useVector) {
      let embedding: number[] = []
      const embeddingResult = (await embedContents([params.content], embeddingSettings)).orUndefined()
      if (embeddingResult)
        embedding = embeddingResult.embeddings[0]

      dbMessages = (await dbModels.chatMessageModels.retrieveMessages(ctx.getDB(), logger, accountId, params.chatId, embeddingDimension, { embedding, text: params.content }, params.pagination, filters)).expect('Failed to retrieve messages')
    }
    else {
      dbMessages = (await dbModels.chatMessageModels.retrieveMessages(ctx.getDB(), logger, accountId, params.chatId, embeddingDimension, { text: params.content }, params.pagination, filters)).expect('Failed to retrieve messages')
    }

    logger.withFields({ count: dbMessages.length }).verbose('Retrieved messages')
    logger.withFields(dbMessages).debug('Retrieved messages')

    const coreMessages = convertToCoreRetrievalMessages(dbMessages)

    ctx.emitter.emit(CoreEventType.StorageSearchMessagesData, { messages: coreMessages })
  })

  ctx.emitter.on(CoreEventType.StorageChatNote, async ({ chatId, note, modify }) => {
    logger.withFields({ chatId, note }).verbose('Recording chat note')

    const accountId = ctx.getCurrentAccountId()
    const hasAccess = (await dbModels.chatModels.isChatAccessibleByAccount(ctx.getDB(), accountId, chatId)).expect('Failed to check chat access')

    if (!hasAccess) {
      ctx.withError('Unauthorized chat access', 'Account does not have access to requested chat note')
      return
    }

    const note_result = await dbModels.chatModels.getOrModifyChatNote(ctx.getDB(), accountId, chatId, note, modify)
    if (note_result !== null) {
      logger.verbose('Successfully recorded chat note')
      ctx.emitter.emit(CoreEventType.StorageChatNoteData, { chatId, note: note_result })
    }
    else {
      ctx.withError('Failed to record chat note', 'Failed to record chat note')
    }
  })
}
