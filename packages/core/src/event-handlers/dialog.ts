import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { Models } from '../models'
import type { DialogService } from '../services'

export function registerDialogEventHandlers(ctx: CoreContext, logger: Logger, dbModels: Models) {
  logger = logger.withContext('core:dialog:event')

  return (dialogService: DialogService) => {
    ctx.emitter.on('dialog:fetch', async () => {
      logger.verbose('Fetching dialogs')

      const dialogs = (await dialogService.fetchDialogs()).expect('Failed to fetch dialogs')

      // Get current account ID from context
      const accountId = ctx.getCurrentAccountId()

      // Enrich dialogs with folderIds from DB if available
      const dbChats = (await dbModels.chatModels.fetchChatsByAccountId(ctx.getDB(), accountId)).orUndefined()
      if (dbChats) {
        for (const dialog of dialogs) {
          const dbChat = dbChats.find(c => c.chat_id === String(dialog.id))
          if (dbChat) {
            dialog.folderIds = dbChat.folder_ids ?? []
          }
          else {
            dialog.folderIds = []
          }
        }
      }
      else {
        // Ensure folderIds is at least an empty array
        for (const dialog of dialogs) {
          dialog.folderIds = []
        }
      }

      ctx.emitter.emit('dialog:data', { dialogs })
      ctx.emitter.emit('storage:record:dialogs', { dialogs, accountId })
    })

    ctx.emitter.on('dialog:folders:fetch', async () => {
      logger.verbose('Fetching chat folders')

      const folders = (await dialogService.fetchChatFolders()).expect('Failed to fetch chat folders')
      const accountId = ctx.getCurrentAccountId()

      ctx.emitter.emit('storage:record:chat-folders', { folders, accountId })
    })

    // Prioritized single-avatar fetch for viewport-visible items
    ctx.emitter.on('dialog:avatar:fetch', async ({ chatId }) => {
      logger.withFields({ chatId }).verbose('Fetching single dialog avatar')
      await dialogService.fetchSingleDialogAvatar(String(chatId))
    })
  }
}
