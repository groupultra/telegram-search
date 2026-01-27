import type { Logger } from '@guiiai/logg'
import type { Result } from '@unbird/result'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { CoreContext } from '../context'
import type { CoreChatFolder, CoreDialog } from '../types/dialog'

import bigInt from 'big-integer'

import { circularObject } from '@tg-search/common'
import { withSpan } from '@tg-search/observability'
import { Ok } from '@unbird/result'
import { Api } from 'telegram'

import { useAvatarHelper } from '../message-resolvers/avatar-resolver'
import { CoreEventType } from '../types/events'
import { getApiChatIdFromMtpPeer, resolveDialog } from '../utils/dialog'

export type DialogService = ReturnType<typeof createDialogService>

export function createDialogService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:dialog')

  /**
   * Centralized avatar helper bound to this context.
   * Provides shared caches and dedup across services/resolvers.
   */
  const avatarHelper = useAvatarHelper(ctx, logger)

  async function fetchChatFolders(): Promise<Result<CoreChatFolder[]>> {
    return withSpan('core:dialog:service:fetchChatFolders', async () => {
      const result = await ctx.getClient().invoke(new Api.messages.GetDialogFilters())

      if (!result || !(result instanceof Api.messages.DialogFilters)) {
        return Ok([])
      }

      const folders: CoreChatFolder[] = []
      for (const filter of result.filters) {
        if (filter instanceof Api.DialogFilter || filter instanceof Api.DialogFilterChatlist) {
          const folder: CoreChatFolder = {
            id: filter.id,
            title: filter.title.text,
            emoticon: filter.emoticon,
            includedChatIds: [],
            excludedChatIds: [],
            pinnedChatIds: [],
          }

          if (filter instanceof Api.DialogFilter) {
            folder.contacts = filter.contacts
            folder.nonContacts = filter.nonContacts
            folder.groups = filter.groups
            folder.broadcasts = filter.broadcasts
            folder.bots = filter.bots
            folder.excludeMuted = filter.excludeMuted
            folder.excludeRead = filter.excludeRead
            folder.excludeArchived = filter.excludeArchived
            folder.includedChatIds = filter.includePeers.map(getApiChatIdFromMtpPeer).filter((id): id is number => id !== undefined)
            folder.excludedChatIds = filter.excludePeers.map(getApiChatIdFromMtpPeer).filter((id): id is number => id !== undefined)
            folder.pinnedChatIds = filter.pinnedPeers.map(getApiChatIdFromMtpPeer).filter((id): id is number => id !== undefined)
          }
          else if (filter instanceof Api.DialogFilterChatlist) {
            folder.includedChatIds = filter.includePeers.map(getApiChatIdFromMtpPeer).filter((id): id is number => id !== undefined)
            folder.pinnedChatIds = filter.pinnedPeers.map(getApiChatIdFromMtpPeer).filter((id): id is number => id !== undefined)
          }

          folders.push(folder)
        }
      }

      logger.withFields({ count: folders.length }).verbose('Fetched chat folders')

      ctx.emitter.emit(CoreEventType.DialogFoldersData, { folders })

      return Ok(folders)
    })
  }

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
          isContact: result.isContact,
          unreadCount,
          messageCount,
          lastMessage,
          lastMessageDate,
          avatarFileId: result.avatarFileId,
          avatarUpdatedAt: result.avatarUpdatedAt,
          pinned,
          folderIds: [],
          accessHash: result.accessHash,
        })
      }

      logger.withFields({ count: dialogs.length }).verbose('Fetched dialogs')

      return Ok(dialogs)
    })
  }

  async function fetchSingleDialogAvatar(chatId: string | number) {
    return withSpan('core:dialog:service:fetchSingleDialogAvatar', async () => {
      // Do not pass long-lived entity overrides; rely on helper's LRU/TTL or fresh resolution
      await avatarHelper.fetchDialogAvatar(chatId)
    })
  }

  async function fetchContacts(): Promise<void> {
    return withSpan('core:dialog:service:fetchContacts', async () => {
      try {
        const result = await ctx.getClient().invoke(new Api.contacts.GetContacts({ hash: bigInt(0) }))
        if (result instanceof Api.contacts.Contacts) {
          logger.withFields({ count: result.users.length }).verbose('Fetched contacts')
          // Process entities to save access hashes
          ctx.emitter.emit(CoreEventType.EntityProcess, { users: result.users, chats: [] })
        }
      }
      catch (err) {
        logger.withError(err).warn('Failed to fetch contacts')
      }
    })
  }

  return {
    fetchDialogs,
    fetchContacts,
    fetchChatFolders,
    // Delegated to AvatarHelper
    fetchDialogAvatars: async (dialogs: Dialog[]) => {
      await avatarHelper.fetchDialogAvatars(dialogs)
    },
    fetchSingleDialogAvatar,
  }
}
