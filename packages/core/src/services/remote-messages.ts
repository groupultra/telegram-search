import type { CursorPage, ListRemoteMessagesInput, MessageRecord } from '@tg-search/protocol'
import type { TelegramClient } from 'telegram'

import type { CoreMessage } from '../types/message'

import { Api } from 'telegram'

import { convertToCoreMessage } from '../utils/message'

// Telegram caps one history or search request at 100 messages.
const CHUNK_SIZE = 100
// Chunks a page may read beyond what its limit needs, so skipped messages cannot make one call scan a whole chat.
const EXTRA_CHUNKS = 2

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

/**
 * Reads a chat newest-first, optionally narrowed by text, sender, and an inclusive time window.
 *
 * Positions are message IDs, which stay valid while the chat receives new messages:
 * `cursor` is the ID to continue strictly below. A page may hold fewer than `limit`
 * items, even none; only `nextCursor: null` means everything requested has been read.
 */
export function createRemoteMessagesService(
  client: TelegramClient,
  resolveInputPeer: (chatId: string) => Promise<Api.TypeInputPeer> = chatId => client.getInputEntity(chatId),
) {
  return async function listRemoteMessages(input: ListRemoteMessagesInput): Promise<CursorPage<MessageRecord>> {
    const peer = await resolveInputPeer(input.chatId)
    const items: MessageRecord[] = []
    const maxChunks = Math.ceil(input.limit / CHUNK_SIZE) + EXTRA_CHUNKS
    let offsetId = input.cursor === undefined ? 0 : Number(input.cursor)
    let total: number | undefined

    for (let chunkCount = 0; chunkCount < maxChunks; chunkCount++) {
      // One request per call: GramJS reapplies addOffset to every chunk it loads itself,
      // so multi-chunk reads are driven here with the message ID as the only offset.
      const chunk = await client.getMessages(peer, {
        limit: Math.min(CHUNK_SIZE, input.limit - items.length),
        offsetId,
        // GramJS treats offsetDate as exclusive; +1 preserves the CLI's inclusive --to contract.
        offsetDate: offsetId === 0 && input.to !== undefined ? input.to + 1 : undefined,
        search: input.query,
        fromUser: input.fromUserId,
        minId: input.minMessageId,
      })
      total ??= chunk.total

      // Telegram may return short chunks before the end, so only an empty one proves exhaustion.
      if (chunk.length === 0)
        return { items, nextCursor: null, total }

      for (const message of chunk) {
        if (input.from !== undefined && message.date < input.from)
          return { items, nextCursor: null, total }

        // Every scanned message advances the position, including ones that produce no record.
        offsetId = message.id
        if (!(message instanceof Api.Message) || (input.to !== undefined && message.date > input.to))
          continue

        const converted = convertToCoreMessage(message).orUndefined()
        if (converted)
          items.push(coreMessageToRecord(converted))
      }

      if (items.length >= input.limit)
        break
    }

    return { items, nextCursor: String(offsetId), total }
  }
}
