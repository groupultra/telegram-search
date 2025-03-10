import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * Enum for message types in the database
 * Used to categorize different kinds of messages for filtering and statistics
 */
export const databaseMessageTypeEnum = pgEnum('message_type', [
  'text', // Plain text messages
  'photo', // Photo messages
  'video', // Video messages
  'document', // Document/file messages
  'sticker', // Sticker messages
  'other', // Other message types
] as const)

export type DatabaseMessageType = (typeof databaseMessageTypeEnum.enumValues)[number]

/**
 * Enum for chat types in the database
 * Used to distinguish between different chat contexts
 */
export const databaseChatTypeEnum = pgEnum('chat_type', [
  'user', // Direct messages with users
  'group', // Group chats
  'channel', // Broadcast channels
  'saved', // Saved messages
] as const)

export type DatabaseChatType = (typeof databaseChatTypeEnum.enumValues)[number]

/**
 * Type definition for media file metadata
 * Stores information about media files attached to messages
 */
export interface DatabaseMediaInfo {
  // Required fields
  fileId: string // Unique identifier for the file
  type: DatabaseMessageType // Type of media, aligned with DatabaseMessageType

  // Optional metadata
  mimeType?: string // MIME type of the file
  fileName?: string // Original filename
  fileSize?: number // Size in bytes

  // Media dimensions
  width?: number // Width in pixels
  height?: number // Height in pixels
  duration?: number // Duration in seconds for video/audio

  // Thumbnail information
  thumbnail?: {
    fileId: string // Thumbnail file ID
    width: number // Thumbnail width
    height: number // Thumbnail height
  }

  // Local storage
  localPath?: string // Path to cached file on disk
}

// 模型配置类型定义
export interface EmbeddingTableConfig {
  provider: string // 模型提供商
  model: string // 模型名称
  dimensions: number // 模型维度
  metadata?: { // 额外元数据
    [key: string]: any // 其他配置项
  }
}
