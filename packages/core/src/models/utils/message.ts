import type { UUID } from 'node:crypto'
import type { chatMessagesTable } from '../../db/schema'
import type { CoreRetrivalMessages } from '../../services'
import type { CoreMessage } from '../../utils/message'

export type DBInsertMessage = typeof chatMessagesTable.$inferInsert
export type DBSelectMessage = typeof chatMessagesTable.$inferSelect

export interface DBRetrivalMessages extends Omit<DBSelectMessage, 'content_vector_1536' | 'content_vector_1024' | 'content_vector_768'> {
  similarity?: number
  time_relevance?: number
  combined_score?: number
}

export function convertToCoreMessageFromDB(message: DBSelectMessage): CoreMessage {
  return {
    uuid: message.id as UUID,

    platform: message.platform,
    platformMessageId: message.platform_message_id,
    chatId: message.in_chat_id,

    fromId: message.from_id,
    fromName: message.from_name,

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

export function convertToDBInsertMessage(message: CoreMessage): DBInsertMessage {
  return {
    platform: message.platform,
    from_id: message.fromId,
    platform_message_id: message.platformMessageId,
    from_name: message.fromName,
    in_chat_id: message.chatId,
    content: message.content,
    is_reply: message.reply.isReply,
    reply_to_name: message.reply.replyToName,
    reply_to_id: message.reply.replyToId,
    content_vector_1536: message.vectors.vector1536?.length !== 0 ? message.vectors.vector1536 : null,
    content_vector_1024: message.vectors.vector1024?.length !== 0 ? message.vectors.vector1024 : null,
    content_vector_768: message.vectors.vector768?.length !== 0 ? message.vectors.vector768 : null,
    jieba_tokens: message.jiebaTokens,
    platform_timestamp: message.platformTimestamp,
  } satisfies DBInsertMessage
}

export function convertToCoreRetrivalMessages(messages: DBRetrivalMessages[]): CoreRetrivalMessages[] {
  return messages.map(message => ({
    ...convertToCoreMessageFromDB(message as DBSelectMessage),
    similarity: message?.similarity,
    timeRelevance: message?.time_relevance,
    combinedScore: message?.combined_score,
  })) satisfies CoreRetrivalMessages[]
}
