import type { DatabaseMediaInfo, DatabaseMessageType } from '../../schema'
import type { tsvector } from '../../schema/utils/tsvector'

/**
 * Base message fields shared across interfaces
 */
interface BaseMessage {
  id: number
  chatId: number
  type: DatabaseMessageType
  content?: string | null
  createdAt: Date
  tsContent?: typeof tsvector // Added for full-text search support
}

/**
 * Message sender information
 */
interface MessageSender {
  fromId?: number | null
  fromName?: string | null
  fromAvatar?: {
    type: 'photo' | 'emoji'
    value: string
    color?: string
  } | null
}

/**
 * Message forwarding information
 */
interface MessageForward {
  forwardFromChatId?: number | null
  forwardFromChatName?: string | null
  forwardFromMessageId?: number | null
}

/**
 * Message metadata and stats
 */
interface MessageMeta {
  views?: number | null
  forwards?: number | null
  links?: string[] | null
  metadata?: Record<string, unknown> | null
  mediaInfo?: DatabaseMediaInfo | null
}

/**
 * Input for creating new messages
 */
export interface MessageCreateInput extends BaseMessage, MessageSender, MessageForward, MessageMeta {
  replyToId?: number | null
  uuid?: string | null
}

/**
 * Options for searching messages
 */
export interface SearchOptions {
  chatId: number // Required for partition table lookup
  type?: DatabaseMessageType
  startTime?: Date
  endTime?: Date
  limit?: number
  offset?: number
  query?: string // Added for full-text search support
}

/**
 * Message with vector similarity score
 */
export interface MessageWithSimilarity extends Pick<BaseMessage, 'id' | 'chatId' | 'type' | 'content' | 'createdAt'> {
  fromId: number | null
  similarity: number
}
