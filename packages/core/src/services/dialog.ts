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

  /**
   * In-memory map of dialog entities keyed by `chatId`.
   * Helps resolve a single dialog entity quickly for prioritized avatar fetching.
   */
  const dialogEntities = new Map<number, Api.User | Api.Chat | Api.Channel>()

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

      // Cache entity for prioritized single fetch later
      try {
        const id = dialog.entity.id?.toJSNumber?.()
        if (id)
          dialogEntities.set(id, dialog.entity as Api.User | Api.Chat | Api.Channel)
      }
      catch {}

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

    // Kick off avatar download in background
    void avatarHelper.fetchDialogAvatars(dialogList, 12).catch(error => logger.withError(error).warn('Failed to fetch dialog avatars'))

    return Ok(dialogs)
  }

  // Removed legacy local `fetchDialogAvatars` implementation.
  // Avatars are now fetched via centralized AvatarHelper for consistency.

  /**
   * Fetch a single dialog's small avatar immediately and emit incremental update.
   *
   * Logic:
   * - Resolve dialog entity from in-memory map or via Telegram API.
   * - If cached and `fileId` unchanged, skip redundant emit.
   * - Dedupe concurrent requests for the same `chatId` to avoid wasted work.
   * - Download small avatar bytes and emit `dialog:avatar:data`.
   */
  /**
   * Fetch a single dialog avatar via centralized AvatarHelper.
   * Reuses dialog entity cache populated during fetchDialogs when available.
   */
  async function fetchSingleDialogAvatar(chatId: string | number) {
    await avatarHelper.fetchDialogAvatar(chatId, { entityOverride: dialogEntities.get(typeof chatId === 'string' ? Number(chatId) : chatId) })
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
