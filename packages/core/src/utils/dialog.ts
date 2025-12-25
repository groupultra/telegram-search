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
  isContact?: boolean
  avatarFileId?: string
  avatarUpdatedAt?: Date
  accessHash?: string
}> {
  const { isGroup, isChannel, isUser } = dialog
  const id = dialog.entity?.id
  if (!id) {
    return Err('Unknown dialog with no id')
  }

  let { name } = dialog
  if (!name) {
    name = id.toString()
  }

  // Extract avatar fileId and flags
  let avatarFileId: string | undefined
  let accessHash: string | undefined
  let isBot = false
  let isContact = false
  let isMegagroup = false

  try {
    if (dialog.entity instanceof Api.User) {
      if (dialog.entity.photo && 'photoId' in dialog.entity.photo) {
        avatarFileId = (dialog.entity.photo as Api.UserProfilePhoto).photoId?.toString()
      }
      accessHash = dialog.entity.accessHash?.toString()
      isBot = dialog.entity.bot || false
      isContact = dialog.entity.contact || false
    }
    else if (dialog.entity instanceof Api.Channel) {
      if (dialog.entity.photo && 'photoId' in dialog.entity.photo) {
        avatarFileId = (dialog.entity.photo as Api.ChatPhoto).photoId?.toString()
      }
      accessHash = dialog.entity.accessHash?.toString()
      isMegagroup = dialog.entity.megagroup || false
    }
    else if (dialog.entity instanceof Api.Chat && dialog.entity.photo && 'photoId' in dialog.entity.photo) {
      avatarFileId = (dialog.entity.photo as Api.ChatPhoto).photoId?.toString()
    }
  }
  catch {}

  let type: DialogType
  if (isMegagroup) {
    type = 'supergroup'
  }
  else if (isGroup) {
    type = 'group'
  }
  else if (isChannel) {
    type = 'channel'
  }
  else if (isUser) {
    type = isBot ? 'bot' : 'user'
  }
  else {
    return Err('Unknown dialog')
  }

  return Ok({
    id: id.toJSNumber(),
    name,
    type,
    isContact,
    avatarFileId,
    avatarUpdatedAt: undefined,
    accessHash,
  })
}

/**
 * Extract a JS number ID from various Telegram Peer types.
 */
export function getApiChatIdFromMtpPeer(peer: Api.TypeInputPeer | Api.TypePeer): number | undefined {
  if (peer instanceof Api.InputPeerUser || peer instanceof Api.PeerUser) {
    return peer.userId.toJSNumber()
  }
  if (peer instanceof Api.InputPeerChat || peer instanceof Api.PeerChat) {
    return peer.chatId.toJSNumber()
  }
  if (peer instanceof Api.InputPeerChannel || peer instanceof Api.PeerChannel) {
    return peer.channelId.toJSNumber()
  }

  // Api.InputPeerSelf will fall through and return undefined, which is correct.
  return undefined
}
