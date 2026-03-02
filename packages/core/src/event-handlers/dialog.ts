import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { Models } from '../models'
import type { DialogService } from '../services'

import { defineInvokeHandler } from '@moeru/eventa'

import { dialogAvatarFetchEvent, dialogFetchInvoke, dialogFoldersFetchInvoke, storageRecordChatFoldersEvent, storageRecordDialogsEvent } from '../events'
import { onEvent } from '../utils/promise'

export async function fetchDialogs(ctx: CoreContext, logger: Logger, dbModels: Models, dialogService: DialogService) {
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

  return { dialogs, accountId }
}

export function registerDialogEventHandlers(ctx: CoreContext, logger: Logger, dbModels: Models) {
  logger = logger.withContext('core:dialog:event')

  return (dialogService: DialogService) => {
    defineInvokeHandler(ctx.ctx, dialogFetchInvoke, async () => {
      const { dialogs, accountId } = await fetchDialogs(ctx, logger, dbModels, dialogService)
      ctx.ctx.emit(storageRecordDialogsEvent, { dialogs, accountId })
      return { dialogs }
    })

    defineInvokeHandler(ctx.ctx, dialogFoldersFetchInvoke, async () => {
      logger.verbose('Fetching chat folders')

      const folders = (await dialogService.fetchChatFolders()).expect('Failed to fetch chat folders')
      const accountId = ctx.getCurrentAccountId()

      ctx.ctx.emit(storageRecordChatFoldersEvent, { folders, accountId })
      return { folders }
    })

    // Prioritized single-avatar fetch for viewport-visible items
    onEvent(ctx.ctx, dialogAvatarFetchEvent, async ({ chatId }) => {
      logger.withFields({ chatId }).verbose('Fetching single dialog avatar')
      await dialogService.fetchSingleDialogAvatar(String(chatId))
    })
  }
}
