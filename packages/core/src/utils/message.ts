import type { Result } from '@unbird/result'

import type { CoreMessageMedia } from '../types/media'
import type { CoreMessage, CoreMessageForward, CoreMessageReply } from '../types/message'

import bigInt from 'big-integer'

import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'
import { v4 as uuidv4 } from 'uuid'

import { parseMediaId, parseMediaType } from './media'

/**
 * Chat ID used by `CoreMessage.chatId` for a Telegram peer.
 */
export function getPeerChatId(peerId: Api.TypePeer | undefined): string {
  if (peerId instanceof Api.PeerUser) {
    return String(peerId.userId.toJSNumber())
  }
  if (peerId instanceof Api.PeerChat) {
    return String(peerId.chatId.toJSNumber())
  }
  if (peerId instanceof Api.PeerChannel) {
    return String(peerId.channelId.toJSNumber())
  }

  return ''
}

export function convertToCoreMessage(message: Api.Message): Result<CoreMessage> {
  const messageUUID = uuidv4()

  const sender = message.sender
  const senderId = typeof message.senderId === 'string' ? bigInt(message.senderId) : message.senderId

  if ((!sender && !senderId) || (sender instanceof Api.UserEmpty) || (sender instanceof Api.ChatEmpty)) {
    return Err(new Error(`Message ${message.id} has no sender or sender is empty`))
  }

  let fromName = ''
  if (sender instanceof Api.User) {
    if ([sender.firstName, sender.lastName].some(Boolean)) {
      fromName = [sender.firstName, sender.lastName].filter(Boolean).join(' ').trim()
    }
    else {
      fromName = sender.username ?? String(sender.id)
    }
  }
  else {
    fromName = sender?.title ?? String(senderId)
  }

  const chatId = getPeerChatId(message.peerId)

  const messageId = String(message.id)
  const fromId = String(senderId?.toJSNumber())
  const content = message.message

  // Get forward info
  const forward: CoreMessageForward = {
    isForward: !!message.fwdFrom,
    forwardFromChatId: message.fwdFrom?.fromId instanceof Api.PeerChannel
      ? message.fwdFrom.fromId.channelId.toString()
      : undefined,
    forwardFromChatName: undefined, // Needs async channel lookup
    forwardFromMessageId: message.fwdFrom?.channelPost?.toString(),
    fromSenderId: message.fwdFrom?.fromId instanceof Api.PeerUser ? message.fwdFrom.fromId.userId.toString() : undefined,
    fromName: message.fwdFrom?.fromName,
    date: message.fwdFrom?.date,
    postAuthor: message.fwdFrom?.postAuthor,
  }

  // Get reply info
  const reply: CoreMessageReply = {
    isReply: !!message.replyTo,
    replyToId: message.replyTo?.replyToMsgId?.toString(),
    replyToName: undefined, // Needs async user lookup
  }

  // Waiting for media resolver to fetch media (no raw Telegram types attached)
  const media: CoreMessageMedia[] = []
  if (message.media) {
    media.push({
      messageUUID,
      type: parseMediaType(message.media),
      platformId: parseMediaId(message.media),
    } as CoreMessageMedia)
  }

  return Ok(
    {
      uuid: messageUUID,
      platform: 'telegram',
      platformMessageId: messageId,
      chatId,
      fromId,
      fromName,
      content,
      media,
      reply,
      telegramMetadata: {
        replyToChatId: message.replyTo?.replyToPeerId instanceof Api.PeerChannel
          ? message.replyTo.replyToPeerId.channelId.toString()
          : message.replyTo?.replyToPeerId instanceof Api.PeerChat
            ? message.replyTo.replyToPeerId.chatId.toString()
            : message.replyTo?.replyToPeerId instanceof Api.PeerUser
              ? message.replyTo.replyToPeerId.userId.toString()
              : undefined,
        replyToTopId: message.replyTo?.replyToTopId?.toString(),
        forumTopic: message.replyTo?.forumTopic,
        quote: message.replyTo?.quoteText === undefined
          ? undefined
          : {
              text: message.replyTo.quoteText,
              offset: message.replyTo.quoteOffset,
              manual: message.replyTo.quote,
            },
        groupedId: message.groupedId?.toString(),
        editedAt: message.editDate,
      },
      forward,
      platformTimestamp: message.date,
    } satisfies CoreMessage,
  )
}
