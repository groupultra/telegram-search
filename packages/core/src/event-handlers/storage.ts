import type { CoreContext } from '../context'

import { useLogger } from '@tg-search/common'

import { recordJoinedChats } from '../models/chats'

export function registerStorageEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:storage:event')

  // emitter.on('storage:fetch:messages', async ({ chatId, pagination }) => {
  //   logger.withFields({ chatId, pagination }).debug('Fetching messages')
  //   const messages = await findLastNMessages(chatId, pagination)
  // })

  // emitter.on('storage:record:messages', async ({ messages }) => {
  //   logger.withFields({ messages }).debug('Recording messages')
  //   await recordMessages(messages)
  // })

  // emitter.on('storage:fetch:dialogs', async () => {
  //   logger.debug('Fetching dialogs')

  //   const dialogs = await listJoinedChats()
  //   emitter.emit('storage:dialogs', {
  //     dialogs: dialogs.map(dialog => ({
  //       id: Number(dialog.chat_id),
  //       name: dialog.chat_name,
  //       type: 'group',
  //       unreadCount: 0,
  //       messageCount: 0,
  //     })),
  //   })
  // })

  emitter.on('storage:record:dialogs', async ({ dialogs }) => {
    logger.withFields({ dialogs }).debug('Recording dialogs')
    recordJoinedChats(dialogs.map(dialog => ({
      chatId: dialog.id.toString(),
      chatName: dialog.name,
    })))
  })
}
