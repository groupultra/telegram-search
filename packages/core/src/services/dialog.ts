import type { Logger } from '@guiiai/logg'
import type { Result } from '@unbird/result'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { CoreContext } from '../context'
import type { CoreDialog } from '../types/dialog'

import { circularObject } from '@tg-search/common'
import { withSpan } from '@tg-search/observability'
import { Ok } from '@unbird/result'

import { useAvatarHelper } from '../message-resolvers/avatar-resolver'
import { resolveDialog } from '../utils/dialog'

export type DialogService = ReturnType<typeof createDialogService>

export function createDialogService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:dialog')

  /**
   * Centralized avatar helper bound to this context.
   * Provides shared caches and dedup across services/resolvers.
   */
  const avatarHelper = useAvatarHelper(ctx, logger)

  /**
   * Fetch dialogs and emit base data. Then asynchronously fetch avatars.
   *
   * This emits `dialog:data` with the list of dialogs immediately.
   * Avatar bytes are downloaded in the background via `fetchDialogAvatars`.
   */
  async function fetchDialogs(): Promise<Result<CoreDialog[]>> {
    return withSpan('core:dialog:service:fetchDialogs', async () => {
      // TODO: use invoke api
      // TODO: use pagination
      // Total list has a total property
      const dialogList = await ctx.getClient().getDialogs()
      // const dialogs = await getClient().invoke(new Api.messages.GetDialogs({})) as Api.messages.Dialogs

      const dialogs: CoreDialog[] = []
      for (const dialog of dialogList) {
        if (!dialog.entity) {
          continue
        }

        const result = resolveDialog(dialog).orUndefined()
        if (!result) {
          logger.withFields({ dialog: circularObject(dialog) }).warn('Failed to resolve dialog')
          continue
        }

        let messageCount = 0
        let lastMessage: string | undefined
        let lastMessageDate: Date | undefined
        const unreadCount = dialog.unreadCount
        const pinned = dialog.pinned || false

        if ('participantsCount' in dialog.entity) {
          messageCount = dialog.entity.participantsCount || 0
        }

        if (dialog.message) {
          lastMessage = dialog.message.message
          lastMessageDate = new Date(dialog.message.date * 1000)
        }

        dialogs.push({
          id: result.id,
          name: result.name,
          type: result.type,
          unreadCount,
          messageCount,
          lastMessage,
          lastMessageDate,
          avatarFileId: result.avatarFileId,
          avatarUpdatedAt: result.avatarUpdatedAt,
          pinned,
          accessHash: result.accessHash,
        })
      }

      logger.withFields({ count: dialogs.length }).verbose('Fetched dialogs')

      ctx.emitter.emit('dialog:data', { dialogs })

      return Ok(dialogs)
    })
  }

  async function fetchSingleDialogAvatar(chatId: string | number) {
    return withSpan('core:dialog:service:fetchSingleDialogAvatar', async () => {
      // Do not pass long-lived entity overrides; rely on helper's LRU/TTL or fresh resolution
      await avatarHelper.fetchDialogAvatar(chatId)
    })
  }

  return {
    fetchDialogs,
    // Delegated to AvatarHelper
    fetchDialogAvatars: async (dialogs: Dialog[]) => {
      await avatarHelper.fetchDialogAvatars(dialogs)
    },
    fetchSingleDialogAvatar,
  }
}
