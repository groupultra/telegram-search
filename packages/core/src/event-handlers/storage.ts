import type { CoreContext } from '../context'
import type { DBRetrievalMessages } from '../models'
import type { CoreDialog } from '../services'

import { useLogger } from '@unbird/logg'

import { convertToCoreRetrievalMessages, fetchChats, fetchMessagesWithPhotos, getChatMessagesStats, recordChats, recordMessagesWithMedia, retrieveMessages } from '../models'
import { embedContents } from '../utils/embed'

export function registerStorageEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:storage:event')

  emitter.on('storage:fetch:messages', async ({ chatId, pagination }) => {
    logger.withFields({ chatId, pagination }).verbose('Fetching messages')
    const messages = (await fetchMessagesWithPhotos(chatId, pagination)).unwrap()
    emitter.emit('storage:messages', { messages })
  })

  emitter.on('storage:record:messages', async ({ messages }) => {
    logger.withFields({ messages: messages.length }).verbose('Recording messages')
    logger.withFields(
      messages
        .map(m => ({
          ...m,
          vectors: {
            vector1536: m.vectors.vector1536?.length,
            vector1024: m.vectors.vector1024?.length,
            vector768: m.vectors.vector768?.length,
          },
        })),
    ).debug('Recording messages')
    await recordMessagesWithMedia(messages)
  })

  emitter.on('storage:fetch:dialogs', async () => {
    logger.verbose('Fetching dialogs')

    const dbChats = (await fetchChats())?.unwrap()
    const chatsMessageStats = (await getChatMessagesStats())?.unwrap()

    logger.withFields({ dbChatsSize: dbChats.length, chatsMessageStatsSize: chatsMessageStats.length }).verbose('Chat message stats')

    const dialogs = dbChats.map((chat) => {
      const chatMessageStats = chatsMessageStats.find(stats => stats.chat_id === chat.chat_id)
      return {
        id: Number(chat.chat_id),
        name: chat.chat_name,
        type: chat.chat_type,
        messageCount: chatMessageStats?.message_count,
      } satisfies CoreDialog
    })

    emitter.emit('storage:dialogs', { dialogs })
  })

  emitter.on('storage:record:dialogs', async ({ dialogs }) => {
    logger.withFields({
      size: dialogs.length,
      users: dialogs.filter(d => d.type === 'user').length,
      groups: dialogs.filter(d => d.type === 'group').length,
      channels: dialogs.filter(d => d.type === 'channel').length,
    }).verbose('Recording dialogs')

    await recordChats(dialogs)
  })

  emitter.on('storage:search:messages', async (params) => {
    logger.withFields({ params }).verbose('Searching messages')

    if (params.content.length === 0) {
      return
    }

    let dbMessages: DBRetrievalMessages[] = []
    if (params.useVector) {
      const { embeddings } = (await embedContents([params.content])).expect('Failed to embed content')

      dbMessages = (await retrieveMessages(params.chatId, { embedding: embeddings[0], text: params.content }, params.pagination)).expect('Failed to retrieve messages')
    }
    else {
      dbMessages = (await retrieveMessages(params.chatId, { text: params.content }, params.pagination)).expect('Failed to retrieve messages')
    }

    logger.withFields({ messages: dbMessages.length }).verbose('Retrieved messages')
    logger.withFields(dbMessages).debug('Retrieved messages')

    const coreMessages = convertToCoreRetrievalMessages(dbMessages)

    emitter.emit('storage:search:messages:data', { messages: coreMessages })
  })
}
