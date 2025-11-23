import type { chatMessagesTable } from '../../schemas/chat-messages'
import type { CoreRetrievalMessages } from '../../types/events'
import type { CoreMessage } from '../../types/message'

export type DBInsertMessage = typeof chatMessagesTable.$inferInsert
export type DBSelectMessage = typeof chatMessagesTable.$inferSelect

export interface DBRetrievalMessages extends Omit<DBSelectMessage, 'content_vector_1536' | 'content_vector_1024' | 'content_vector_768'> {
  similarity?: number
  time_relevance?: number
  combined_score?: number
  chat_name?: string | null
}

export function convertToCoreMessageFromDB(message: DBSelectMessage): CoreMessage {
  return {
    uuid: message.id,

    platform: message.platform as 'telegram',
    platformMessageId: message.platform_message_id,
    chatId: message.in_chat_id,

    fromId: message.from_id,
    fromName: message.from_name,
    fromUserUuid: message.from_user_uuid ?? undefined,

    content: message.content,

    reply: {
      isReply: message.is_reply,
      replyToId: message.reply_to_id,
      replyToName: message.reply_to_name,
    },
    forward: {
      isForward: false,
      // forwardFromChatId: message.forward_from_chat_id,
      // forwardFromChatName: message.forward_from_chat_name,
      // forwardFromMessageId: message.forward_from_message_id,
    },

    vectors: {
      vector1536: message.content_vector_1536 || [],
      vector1024: message.content_vector_1024 || [],
      vector768: message.content_vector_768 || [],
    },

    jiebaTokens: message.jieba_tokens as unknown as string[],

    createdAt: message.created_at,
    updatedAt: message.updated_at,
    platformTimestamp: message.platform_timestamp,
  } satisfies CoreMessage
}

export function convertToDBInsertMessage(
  ownerAccountId: string | null | undefined,
  message: CoreMessage,
): DBInsertMessage {
  const msg: DBInsertMessage = {
    platform: message.platform,
    from_id: message.fromId,
    platform_message_id: message.platformMessageId,
    from_name: message.fromName,
    from_user_uuid: message.fromUserUuid,
    in_chat_id: message.chatId,
    content: message.content,
    is_reply: message.reply.isReply,
    reply_to_name: message.reply.replyToName,
    reply_to_id: message.reply.replyToId,
    platform_timestamp: message.platformTimestamp,
  }

  if (ownerAccountId) {
    msg.owner_account_id = ownerAccountId
  }

  if (message.vectors.vector1536?.length) {
    msg.content_vector_1536 = message.vectors.vector1536
  }

  if (message.vectors.vector1024?.length) {
    msg.content_vector_1024 = message.vectors.vector1024
  }

  if (message.vectors.vector768?.length) {
    msg.content_vector_768 = message.vectors.vector768
  }

  if (message.jiebaTokens?.length) {
    msg.jieba_tokens = message.jiebaTokens
  }

  return msg
}

export function convertToCoreRetrievalMessages(messages: DBRetrievalMessages[]): CoreRetrievalMessages[] {
  return messages.map(message => ({
    ...convertToCoreMessageFromDB(message as DBSelectMessage),
    similarity: message?.similarity,
    timeRelevance: message?.time_relevance,
    combinedScore: message?.combined_score,
    chatName: message?.chat_name ?? undefined,
  })) satisfies CoreRetrievalMessages[]
}
