import type { Logger } from '@guiiai/logg'
import type { Result } from '@unbird/result'

import type { CoreContext } from '../context'
import type { UserModels } from '../models/users'
import type { DBSelectUser } from '../models/utils/types'
import type { CoreChatFolder, CoreDialog } from '../types/dialog'

import bigInt from 'big-integer'

import { circularObject } from '@tg-search/common'
import { withSpan } from '@tg-search/observability'
import { Ok } from '@unbird/result'
import { Api, utils } from 'telegram'
import { Dialog } from 'telegram/tl/custom/dialog'

import { useAvatarHelper } from '../message-resolvers/avatar-resolver'
import { CoreEventType } from '../types/events'
import { getApiChatIdFromMtpPeer, resolveDialog, resolveDialogMessagePreview, resolveDialogMessageSenderId, resolveDialogMessageSenderName } from '../utils/dialog'

export type DialogService = ReturnType<typeof createDialogService>

export function createDialogService(ctx: CoreContext, logger: Logger, userModels: UserModels) {
  logger = logger.withContext('core:dialog')

  /**
   * Centralized avatar helper bound to this context.
   * Provides shared caches and dedup across services/resolvers.
   */
  const avatarHelper = useAvatarHelper(ctx, logger)

  async function resolveDialogSenderNames(dialogList: Dialog[]) {
    const senderIds = Array.from(new Set(dialogList.flatMap((dialog) => {
      const result = resolveDialog(dialog).orUndefined()
      if (!result || (result.type !== 'group' && result.type !== 'supergroup')) {
        return []
      }

      const senderId = resolveDialogMessageSenderId(dialog.message)
      const senderName = resolveDialogMessageSenderName(dialog.message)

      if (!senderId || (senderName && senderName !== senderId)) {
        return []
      }

      return [senderId]
    })))

    const senderNameMap = new Map<string, string>()
    if (senderIds.length === 0) {
      return senderNameMap
    }

    const dbUsers = (await userModels.findUsersByPlatformIds(ctx.getDB(), 'telegram', senderIds)).orUndefined() ?? []
    const dbUsersByPlatformId = new Map<string, DBSelectUser>(
      dbUsers.map((user: DBSelectUser) => [user.platform_user_id, user]),
    )

    const missingSenderIds = senderIds.filter(senderId => !dbUsersByPlatformId.has(senderId))
    for (const senderId of missingSenderIds) {
      try {
        const rawEntity = await ctx.getClient().getEntity(senderId)
        if (!(rawEntity instanceof Api.User)) {
          continue
        }

        const fullName = [rawEntity.firstName, rawEntity.lastName].filter(Boolean).join(' ').trim()
        const recordedUser = await userModels.recordUser(ctx.getDB(), {
          type: 'user',
          id: rawEntity.id.toString(),
          name: fullName || rawEntity.username || rawEntity.id.toString(),
          username: rawEntity.username ?? rawEntity.id.toString(),
          accessHash: rawEntity.accessHash?.toString(),
        })

        dbUsersByPlatformId.set(senderId, recordedUser)
      }
      catch (error) {
        logger.withFields({ senderId }).withError(error).warn('Failed to resolve dialog preview sender')
      }
    }

    for (const senderId of senderIds) {
      const user = dbUsersByPlatformId.get(senderId)
      if (user?.name) {
        senderNameMap.set(senderId, user.name)
      }
    }

    return senderNameMap
  }

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

  async function fetchPinnedDialogIds(folderId = 0): Promise<Result<number[]>> {
    return withSpan('core:dialog:service:fetchPinnedDialogIds', async () => {
      try {
        const result = await ctx.getClient().invoke(new Api.messages.GetPinnedDialogs({ folderId }))
        if (!(result instanceof Api.messages.PeerDialogs)) {
          return Ok([])
        }

        const pinnedDialogIds = result.dialogs
          .flatMap((dialog) => {
            if (!(dialog instanceof Api.Dialog)) {
              return []
            }

            const chatId = getApiChatIdFromMtpPeer(dialog.peer)
            return chatId === undefined ? [] : [chatId]
          })

        return Ok(pinnedDialogIds)
      }
      catch (error) {
        logger.withFields({ folderId }).withError(error).warn('Failed to fetch pinned dialogs')
        return Ok([])
      }
    })
  }

  // Mirror tdesktop's kChatsSliceLimit (Telegram/SourceFiles/export/export_api_wrap.cpp).
  const CHATS_SLICE_LIMIT = 100

  // Channel message ids collide across peers, so a top message is keyed by
  // (channelId, messageId). The key is internal to this file; it only needs to
  // be unique per (channelId|undefined, messageId), not match any gramjs format.
  function dialogMessageKey(peer: Api.TypePeer, messageId: number): string {
    const channelId = peer instanceof Api.PeerChannel ? peer.channelId : undefined
    return `${channelId},${messageId}`
  }

  /**
   * Fetch split ranges so dialogs are iterated across every server-side message
   * box. Without this, accounts whose total message volume crosses the 500K/1M
   * boundaries lose the dialogs whose top message sits in an older box.
   *
   * NOTICE: tdesktop only ever calls getSplitRanges and InvokeWithMessagesRange
   * inside a takeout session; whether the server honors them on the regular
   * connection (as used here, since dialog sync is not a takeout flow) is not
   * verified against a real multi-box account. Returning [] on failure makes the
   * caller fall back to plain unranged pagination, so this can never regress
   * below the previous client.getDialogs() behavior — it only helps when the
   * server does honor the range.
   *
   * https://core.telegram.org/api/takeout
   * https://core.telegram.org/method/messages.getSplitRanges
   */
  async function getSplitRanges(): Promise<Api.MessageRange[]> {
    try {
      return await ctx.getClient().invoke(new Api.messages.GetSplitRanges())
    }
    catch (error) {
      logger.withError(error).warn('getSplitRanges failed, falling back to unranged dialog pagination')
      return []
    }
  }

  /**
   * Paginate dialogs within a single split range (or the whole account when
   * range is undefined), appending resolved Dialog objects to acc. seen is
   * shared across ranges to drop dialogs that appear in more than one box.
   *
   * Mirrors tdesktop ApiWrap::requestDialogsSlice and gramjs _DialogsIter:
   * each range restarts pagination from offset 0.
   */
  async function collectDialogsForRange(
    range: Api.MessageRange | undefined,
    seen: Set<string>,
    acc: Dialog[],
  ): Promise<void> {
    const client = ctx.getClient()
    let offsetDate = 0
    let offsetId = 0
    let offsetPeer: Api.TypeInputPeer = new Api.InputPeerEmpty()
    let excludePinned = false

    while (true) {
      const getDialogs = new Api.messages.GetDialogs({
        offsetDate,
        offsetId,
        offsetPeer,
        limit: CHATS_SLICE_LIMIT,
        hash: bigInt(0),
        excludePinned,
      })
      const query = range
        ? new Api.InvokeWithMessagesRange({ range, query: getDialogs })
        : getDialogs

      const result = await client.invoke(query) as Api.messages.TypeDialogs
      if (result instanceof Api.messages.DialogsNotModified) {
        break
      }

      const entities = new Map<string, Api.TypeUser | Api.TypeChat>()
      for (const entity of [...result.users, ...result.chats]) {
        if (entity instanceof Api.UserEmpty || entity instanceof Api.ChatEmpty) {
          continue
        }
        entities.set(utils.getPeerId(entity), entity)
      }

      // MessageEmpty/MessageService carry no usable date for the Dialog ctor and
      // no top-message preview, so only real messages enter the lookup map.
      const messages = new Map<string, Api.Message>()
      for (const message of result.messages) {
        if (!(message instanceof Api.Message)) {
          continue
        }
        // NOTICE: _finishInit is a gramjs-internal method (telegram@2.26.22,
        // tl/custom/message.js) that wires sender/chat refs onto the message via
        // _entityCache. We reuse it so dialog preview/sender resolution matches
        // client.getDialogs(). If a future gramjs drops it, the 'in' guard skips
        // enrichment and group last-message sender names degrade silently — the
        // warn log is the only signal, so re-verify on gramjs upgrade.
        if ('_finishInit' in message) {
          try {
            (message as unknown as { _finishInit: (c: unknown, e: unknown, i: unknown) => void })
              ._finishInit(client, entities, undefined)
          }
          catch (error) {
            logger.withError(error).warn('Failed to finish init dialog message')
          }
        }
        messages.set(dialogMessageKey(message.peerId, message.id), message)
      }

      for (const dialog of result.dialogs) {
        if (dialog instanceof Api.DialogFolder) {
          continue
        }
        const peerId = utils.getPeerId(dialog.peer)
        if (seen.has(peerId)) {
          continue
        }

        const entity = entities.get(peerId)
        const message = messages.get(dialogMessageKey(dialog.peer, dialog.topMessage))
        // Dialog ctor reads message.date and throws when entity is missing. Skip
        // without marking seen, so a later range carrying full data still emits it.
        if (!entity || !message) {
          continue
        }
        try {
          acc.push(new Dialog(client, dialog, entities, message))
          seen.add(peerId)
        }
        catch (error) {
          logger.withError(error).warn('Failed to construct dialog')
        }
      }

      const finished = result.dialogs.length < CHATS_SLICE_LIMIT
        || !(result instanceof Api.messages.DialogsSlice)
      if (finished) {
        break
      }

      // Advance offsetId/offsetDate/offsetPeer from a single dialog so the tuple
      // stays internally consistent (the server tie-breaks pages on the peer).
      // When no dialog on the page yields both a message and a resolvable input
      // peer, the offset cannot advance, so stop rather than spin forever.
      let nextOffsetId: number | undefined
      let nextOffsetDate: number | undefined
      let nextOffsetPeer: Api.TypeInputPeer | undefined
      for (const dialog of [...result.dialogs].reverse()) {
        if (dialog instanceof Api.DialogFolder) {
          continue
        }
        const message = messages.get(dialogMessageKey(dialog.peer, dialog.topMessage))
        const entity = entities.get(utils.getPeerId(dialog.peer))
        if (!message || !entity) {
          continue
        }
        try {
          nextOffsetPeer = utils.getInputPeer(entity)
        }
        catch {
          continue
        }
        nextOffsetId = message.id
        nextOffsetDate = message.date
        break
      }
      if (nextOffsetPeer === undefined || nextOffsetId === undefined || nextOffsetDate === undefined) {
        break
      }
      excludePinned = true
      offsetId = nextOffsetId
      offsetDate = nextOffsetDate
      offsetPeer = nextOffsetPeer
    }
  }

  /**
   * Fetch dialogs and emit base data. Then asynchronously fetch avatars.
   *
   * This emits `dialog:data` with the list of dialogs immediately.
   * Avatar bytes are downloaded in the background via `fetchDialogAvatars`.
   */
  async function fetchDialogs(): Promise<Result<CoreDialog[]>> {
    return withSpan('core:dialog:service:fetchDialogs', async () => {
      const splitRanges = await getSplitRanges()
      logger.withFields({ splitRangeCount: splitRanges.length }).verbose('Fetched split ranges for dialogs')

      const seen = new Set<string>()
      const dialogList: Dialog[] = []
      if (splitRanges.length > 0) {
        for (const range of splitRanges) {
          await collectDialogsForRange(range, seen, dialogList)
        }
      }
      else {
        await collectDialogsForRange(undefined, seen, dialogList)
      }

      const senderNameMap = await resolveDialogSenderNames(dialogList)
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
        let lastMessageFromName: string | undefined
        let lastMessage: string | undefined
        let lastMessageDate: Date | undefined
        const unreadCount = dialog.unreadCount
        const pinned = dialog.pinned || false

        if ('participantsCount' in dialog.entity) {
          messageCount = dialog.entity.participantsCount || 0
        }

        if (dialog.message) {
          const senderId = resolveDialogMessageSenderId(dialog.message)
          lastMessageFromName = resolveDialogMessageSenderName(dialog.message)
          if (senderId && (!lastMessageFromName || lastMessageFromName === senderId)) {
            lastMessageFromName = senderNameMap.get(senderId) || lastMessageFromName
          }
          lastMessage = resolveDialogMessagePreview(dialog.message)
          lastMessageDate = new Date(dialog.message.date * 1000)
        }

        dialogs.push({
          id: result.id,
          name: result.name,
          type: result.type,
          isContact: result.isContact,
          unreadCount,
          messageCount,
          lastMessageFromName,
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
    fetchPinnedDialogIds,
    fetchContacts,
    fetchChatFolders,
    // Delegated to AvatarHelper
    fetchDialogAvatars: async (dialogs: Dialog[]) => {
      await avatarHelper.fetchDialogAvatars(dialogs)
    },
    fetchSingleDialogAvatar,
  }
}
