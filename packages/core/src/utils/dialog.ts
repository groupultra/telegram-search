import type { Result } from '@unbird/result'
import type { Dialog } from 'telegram/tl/custom/dialog'

import type { DialogType } from '../types/dialog'

import bigInt from 'big-integer'

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
  username?: string
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
  let username: string | undefined
  let isBot = false
  let isContact = false
  let isMegagroup = false

  if (dialog.entity instanceof Api.User) {
    if (dialog.entity.photo && 'photoId' in dialog.entity.photo) {
      avatarFileId = dialog.entity.photo.photoId?.toString()
    }
    accessHash = dialog.entity.accessHash?.toString()
    isBot = dialog.entity.bot === true
    isContact = dialog.entity.contact === true
  }
  else if (dialog.entity instanceof Api.Channel) {
    if (dialog.entity.photo && 'photoId' in dialog.entity.photo) {
      avatarFileId = dialog.entity.photo.photoId?.toString()
    }
    accessHash = dialog.entity.accessHash?.toString()
    isMegagroup = dialog.entity.megagroup === true
    username = dialog.entity.username ?? undefined
  }
  else if (dialog.entity instanceof Api.Chat && dialog.entity.photo && 'photoId' in dialog.entity.photo) {
    avatarFileId = dialog.entity.photo.photoId?.toString()
  }

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
    username,
  })
}

function resolveMediaPreview(media: Api.TypeMessageMedia): string | undefined {
  if (media instanceof Api.MessageMediaPhoto) {
    return 'Photo'
  }

  if (media instanceof Api.MessageMediaPoll) {
    return 'Poll'
  }

  if (media instanceof Api.MessageMediaGeo || media instanceof Api.MessageMediaGeoLive || media instanceof Api.MessageMediaVenue) {
    return 'Location'
  }

  if (media instanceof Api.MessageMediaContact) {
    return 'Contact'
  }

  if (media instanceof Api.MessageMediaWebPage) {
    return 'Link'
  }

  if (media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document) {
    const attributes = media.document.attributes

    if (attributes.some(attr => attr instanceof Api.DocumentAttributeSticker)) {
      const sticker = attributes.find(attr => attr instanceof Api.DocumentAttributeSticker)
      return sticker?.alt?.trim() || 'Sticker'
    }

    const audio = attributes.find(attr => attr instanceof Api.DocumentAttributeAudio)
    if (audio instanceof Api.DocumentAttributeAudio) {
      return audio.voice ? 'Voice message' : 'Audio'
    }

    const video = attributes.find(attr => attr instanceof Api.DocumentAttributeVideo)
    if (video instanceof Api.DocumentAttributeVideo) {
      return video.roundMessage ? 'Video message' : 'Video'
    }

    const animated = attributes.find(attr => attr instanceof Api.DocumentAttributeAnimated)
    if (animated instanceof Api.DocumentAttributeAnimated) {
      return 'GIF'
    }

    return 'File'
  }

  return undefined
}

export function resolveDialogMessagePreview(message?: Api.TypeMessage): string | undefined {
  if (!message) {
    return undefined
  }

  if (message instanceof Api.Message) {
    const text = message.message?.trim()
    if (text) {
      return text
    }

    if (message.media) {
      return resolveMediaPreview(message.media)
    }
  }

  if (message instanceof Api.MessageService) {
    if (message.action instanceof Api.MessageActionPinMessage) {
      return 'Pinned a message'
    }

    if (message.action instanceof Api.MessageActionChatAddUser) {
      return 'Added members'
    }

    if (message.action instanceof Api.MessageActionChatJoinedByLink) {
      return 'Joined via invite link'
    }

    if (message.action instanceof Api.MessageActionChatEditTitle) {
      return 'Changed group name'
    }

    if (message.action instanceof Api.MessageActionChatEditPhoto) {
      return 'Changed group photo'
    }

    if (message.action instanceof Api.MessageActionChatDeletePhoto) {
      return 'Removed group photo'
    }
  }

  return undefined
}

export function resolveDialogMessageSenderName(message?: Api.TypeMessage): string | undefined {
  if (!(message instanceof Api.Message)) {
    return undefined
  }

  const sender = message.sender
  const senderId = typeof message.senderId === 'string' ? bigInt(message.senderId) : message.senderId

  if ((!sender && !senderId) || sender instanceof Api.UserEmpty || sender instanceof Api.ChatEmpty) {
    return undefined
  }

  if (sender instanceof Api.User) {
    const fullName = [sender.firstName, sender.lastName].filter(Boolean).join(' ').trim()
    return fullName || sender.username || senderId?.toString()
  }

  return sender?.title?.trim() || senderId?.toString()
}

export function resolveDialogMessageSenderId(message?: Api.TypeMessage): string | undefined {
  if (!(message instanceof Api.Message)) {
    return undefined
  }

  const senderId = typeof message.senderId === 'string' ? bigInt(message.senderId) : message.senderId
  return senderId?.toString()
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
