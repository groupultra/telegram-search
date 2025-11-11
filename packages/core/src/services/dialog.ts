import type { Result } from '@unbird/result'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { CoreContext } from '../context'
import type { CoreDialog, DialogType } from '../types/dialog'

import { useLogger } from '@guiiai/logg'
import { circularObject } from '@tg-search/common'
import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'

import { useAvatarHelper } from '../message-resolvers/avatar-resolver'

export type DialogService = ReturnType<typeof createDialogService>

export function createDialogService(ctx: CoreContext) {
  const { getClient, emitter } = ctx

  const logger = useLogger('core:dialog')

  /**
   * Centralized avatar helper bound to this context.
   * Provides shared caches and dedup across services/resolvers.
   */
  const avatarHelper = useAvatarHelper(ctx)

  // Single-fetch deduplication is handled in the centralized helper

  /**
   * Convert a Telegram `Dialog` to minimal `CoreDialog` data.
   * Includes avatar metadata where available (no bytes).
   *
   * @returns Ok result with normalized dialog fields or Err on unknown dialog.
   */
  function resolveDialog(dialog: Dialog): Result<{
    id: number
    name: string
    type: DialogType
    avatarFileId?: string
    avatarUpdatedAt?: Date
  }> {
    const { isGroup, isChannel, isUser } = dialog
    let type: DialogType
    if (isGroup) {
      type = 'group'
    }
    else if (isChannel) {
      type = 'channel'
    }
    else if (isUser) {
      type = 'user'
    }
    else {
      logger.withFields({ dialog: circularObject(dialog) }).warn('Unknown dialog')
      return Err('Unknown dialog')
    }

    const id = dialog.entity?.id
    if (!id) {
      logger.withFields({ dialog: circularObject(dialog) }).warn('Unknown dialog with no id')
      return Err('Unknown dialog with no id')
    }

    let { name } = dialog
    if (!name) {
      name = id.toString()
    }

    // Extract avatar fileId if possible for cache hinting
    let avatarFileId: string | undefined
    try {
      if (dialog.entity instanceof Api.User && dialog.entity.photo && 'photoId' in dialog.entity.photo) {
        avatarFileId = (dialog.entity.photo as Api.UserProfilePhoto).photoId?.toString()
      }
      else if ((dialog.entity instanceof Api.Chat || dialog.entity instanceof Api.Channel) && dialog.entity.photo && 'photoId' in dialog.entity.photo) {
        avatarFileId = (dialog.entity.photo as Api.ChatPhoto).photoId?.toString()
      }
    }
    catch {}

    return Ok({
      id: id.toJSNumber(),
      name,
      type,
      avatarFileId,
      avatarUpdatedAt: undefined,
    })
  }

  /**
   * Fetch dialogs and emit base data. Then asynchronously fetch avatars.
   *
   * This emits `dialog:data` with the list of dialogs immediately.
   * Avatar bytes are downloaded in the background via `fetchDialogAvatars`.
   */
  async function fetchDialogs(): Promise<Result<CoreDialog[]>> {
    // TODO: use invoke api
    // TODO: use pagination
    // Total list has a total property
    const dialogList = await getClient().getDialogs()
    // const dialogs = await getClient().invoke(new Api.messages.GetDialogs({})) as Api.messages.Dialogs

    const dialogs: CoreDialog[] = []
    for (const dialog of dialogList) {
      if (!dialog.entity) {
        continue
      }

      const result = resolveDialog(dialog).orUndefined()
      if (!result) {
        continue
      }

      let messageCount = 0
      let lastMessage: string | undefined
      let lastMessageDate: Date | undefined
      const unreadCount = dialog.unreadCount

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
      })
    }

    useLogger().withFields({ count: dialogs.length }).verbose('Fetched dialogs')

    emitter.emit('dialog:data', { dialogs })

    return Ok(dialogs)
  }

  async function fetchSingleDialogAvatar(chatId: string | number) {
    // Do not pass long-lived entity overrides; rely on helper's LRU/TTL or fresh resolution
    await avatarHelper.fetchDialogAvatar(chatId)
  }

  return {
    fetchDialogs,
    // Delegated to AvatarHelper
    fetchDialogAvatars: async (dialogs: Dialog[]) => {
      await avatarHelper.fetchDialogAvatars(dialogs, 8)
    },
    fetchSingleDialogAvatar,
  }
}
