import type { Result } from '@unbird/result'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { DialogType } from '../types'

import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'

/**
 * Convert a Telegram `Dialog` to minimal `CoreDialog` data.
 * Includes avatar metadata where available (no bytes).
 *
 * @returns Ok result with normalized dialog fields or Err on unknown dialog.
 */
export function resolveDialog(dialog: Dialog): Result<{
  id: number
  name: string
  type: DialogType
  avatarFileId?: string
  avatarUpdatedAt?: Date
  accessHash?: string
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
    return Err('Unknown dialog')
  }

  const id = dialog.entity?.id
  if (!id) {
    return Err('Unknown dialog with no id')
  }

  let { name } = dialog
  if (!name) {
    name = id.toString()
  }

  // Extract avatar fileId if possible for cache hinting
  let avatarFileId: string | undefined
  let accessHash: string | undefined
  try {
    if (dialog.entity instanceof Api.User) {
      if (dialog.entity.photo && 'photoId' in dialog.entity.photo) {
        avatarFileId = (dialog.entity.photo as Api.UserProfilePhoto).photoId?.toString()
      }
      accessHash = dialog.entity.accessHash?.toString()
    }
    else if (dialog.entity instanceof Api.Channel) {
      if (dialog.entity.photo && 'photoId' in dialog.entity.photo) {
        avatarFileId = (dialog.entity.photo as Api.ChatPhoto).photoId?.toString()
      }
      accessHash = dialog.entity.accessHash?.toString()
    }
    else if (dialog.entity instanceof Api.Chat && dialog.entity.photo && 'photoId' in dialog.entity.photo) {
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
    accessHash,
  })
}

/**
 * Extract a JS number ID from various Telegram Peer types.
 * Avoids 'any' by using type guards and checking for property existence.
 */
export function getApiChatIdFromMtpPeer(peer: Api.TypeInputPeer | Api.TypePeer): number | undefined {
  if (peer instanceof Api.InputPeerUser || peer instanceof Api.PeerUser) {
    const p = peer as Api.InputPeerUser | Api.PeerUser
    return 'userId' in p ? p.userId.toJSNumber() : undefined
  }
  if (peer instanceof Api.InputPeerChat || peer instanceof Api.PeerChat) {
    const p = peer as Api.InputPeerChat | Api.PeerChat
    return 'chatId' in p ? p.chatId.toJSNumber() : undefined
  }
  if (peer instanceof Api.InputPeerChannel || peer instanceof Api.PeerChannel) {
    const p = peer as Api.InputPeerChannel | Api.PeerChannel
    return 'channelId' in p ? p.channelId.toJSNumber() : undefined
  }
  if (peer instanceof Api.InputPeerSelf) {
    return undefined
  }
  return undefined
}
