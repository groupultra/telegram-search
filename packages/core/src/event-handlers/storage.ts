import type { CoreContext } from '../context'
import type { CoreDialog } from '../services'

import { useLogger } from '@tg-search/common'

import { recordMessagesWithoutEmbedding } from '../models/chat-message'
import { getChatMessagesStats } from '../models/chat-message-stats'
import { listJoinedChats, recordJoinedChats } from '../models/chats'

export function registerStorageEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:storage:event')

  // emitter.on('storage:fetch:messages', async ({ chatId, pagination }) => {
  //   logger.withFields({ chatId, pagination }).debug('Fetching messages')
  //   const messages = await findLastNMessages(chatId, pagination.limit)
  // })

  emitter.on('storage:record:messages', async ({ messages }) => {
    logger.withFields({ messages }).debug('Recording messages')
    await recordMessagesWithoutEmbedding(messages)
  })

  emitter.on('storage:fetch:dialogs', async () => {
    logger.debug('Fetching dialogs')

    const dbChats = await listJoinedChats()
    const chatsMessageStats = await getChatMessagesStats()

    logger.withFields({ dbChatsSize: dbChats.length, chatsMessageStatsSize: chatsMessageStats.length }).debug('Chat message stats')

    const dialogs = dbChats.map((chat) => {
      const chatMessageStats = chatsMessageStats.find(stats => stats.chat_id === chat.chat_id)
      return {
        id: Number(chat.chat_id),
        name: chat.chat_name,
        type: chat.chat_type,
        messageCount: chatMessageStats?.message_count,
      }
    }) satisfies CoreDialog[]

    emitter.emit('storage:dialogs', { dialogs })
  })

  emitter.on('storage:record:dialogs', async ({ dialogs }) => {
    logger.withFields({ size: dialogs.length }).debug('Recording dialogs')

    const dbChats = dialogs.map(dialog => ({
      chatId: dialog.id.toString(),
      chatName: dialog.name,
      chatType: dialog.type, // FIXME: user
    }))

    await recordJoinedChats(dbChats)
  })
}
