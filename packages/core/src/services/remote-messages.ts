import type { CursorPage, ListRemoteMessagesInput, MessageRecord } from '@tg-search/protocol'
import type { TelegramClient } from 'telegram'

import type { CoreMessage } from '../types/message'

import { Api } from 'telegram'

import { convertToCoreMessage } from '../utils/message'

function cursorOffset(cursor?: string): number {
  const offset = Number.parseInt(cursor ?? '0', 10)
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0
}

export function coreMessageToRecord(message: CoreMessage): MessageRecord {
  return {
    id: message.platformMessageId,
    chatId: message.chatId,
    senderId: message.fromId,
    senderName: message.fromName,
    timestamp: message.platformTimestamp,
    text: message.content,
    replyToId: message.reply.replyToId,
    forward: {
      isForward: message.forward.isForward,
      fromChatId: message.forward.forwardFromChatId,
      fromChatName: message.forward.forwardFromChatName,
      fromMessageId: message.forward.forwardFromMessageId,
    },
    media: (message.media ?? []).map(media => ({
      type: media.type,
      mimeType: media.mimeType,
      telegramReference: media.platformId,
    })),
    links: message.links ?? [],
    editedAt: message.updatedAt,
    deletedAt: message.deletedAt,
  }
}

export function createRemoteMessagesService(
  client: TelegramClient,
  resolveInputPeer: (chatId: string) => Promise<Api.TypeInputPeer> = chatId => client.getInputEntity(chatId),
) {
  return async function listRemoteMessages(input: ListRemoteMessagesInput): Promise<CursorPage<MessageRecord>> {
    const offset = cursorOffset(input.cursor)
    const peer = await resolveInputPeer(input.chatId)
    const rawMessages = await client.getMessages(peer, {
      limit: input.limit + 1,
      addOffset: offset,
      fromUser: input.fromUserId,
      minId: input.minMessageId,
      // GramJS treats offsetDate as exclusive; +1 preserves the CLI's inclusive --to contract.
      offsetDate: input.to === undefined ? undefined : input.to + 1,
    })

    const records = rawMessages
      .filter((message): message is Api.Message => message instanceof Api.Message)
      .filter(message => input.from === undefined || message.date >= input.from)
      .filter(message => input.to === undefined || message.date <= input.to)
      .flatMap((message) => {
        const converted = convertToCoreMessage(message).orUndefined()
        return converted ? [coreMessageToRecord(converted)] : []
      })

    const hasMore = records.length > input.limit
    return {
      items: records.slice(0, input.limit),
      nextCursor: hasMore ? String(offset + input.limit) : null,
      total: rawMessages.total,
    }
  }
}
