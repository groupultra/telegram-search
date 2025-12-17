import type { CorePagination } from '@tg-search/common'
import type { EventEmitter } from 'eventemitter3'
import type { Api } from 'telegram'

import type { AccountSettings } from './account-settings'
import type { CoreDialog } from './dialog'
import type { CoreMessage } from './message'
import type { CoreTask, CoreTaskData } from './task'

// ============================================================================
// Instance Events
// ============================================================================

export interface ClientInstanceEventToCore {
  'core:cleanup': () => void
}

export interface ClientInstanceEventFromCore {
  'core:error': (data: { error: string, description?: string }) => void
}

// ============================================================================
// Connection Events (auth)
// ============================================================================

export interface ConnectionEventToCore {
  'auth:login': (data: { phoneNumber?: string, session?: string }) => void
  'auth:logout': () => void
  'auth:code': (data: { code: string }) => void
  'auth:password': (data: { password: string }) => void
}

export interface ConnectionEventFromCore {
  'auth:code:needed': () => void
  'auth:password:needed': () => void
  'auth:connected': () => void
  'auth:disconnected': () => void
  'auth:error': (data: { error: unknown }) => void
}

// ============================================================================
// Session Events
// ============================================================================

export interface SessionEventToCore {}

export interface SessionEventFromCore {
  'session:update': (data: { session: string }) => void
}

// ============================================================================
// Account Events
// ============================================================================

export interface AccountEventToCore {
  'account:me:fetch': () => void
}

export interface AccountEventFromCore {
  'account:ready': (data: { accountId: string }) => void
}

// ============================================================================
// Account Settings Events
// ============================================================================

export interface AccountSettingsEventToCore {
  'config:fetch': () => void
  'config:update': (data: { accountSettings: AccountSettings }) => void
}

export interface AccountSettingsEventFromCore {
  'config:data': (data: { accountSettings: AccountSettings }) => void
}

// ============================================================================
// Message Events
// ============================================================================

export interface MessageEventToCore {
  'message:fetch': (data: FetchMessageOpts) => void
  'message:fetch:abort': (data: { taskId: string }) => void
  'message:fetch:specific': (data: { chatId: string, messageIds: number[] }) => void
  'message:send': (data: { chatId: string, content: string }) => void
}

export interface MessageEventFromCore {
  'message:fetch:progress': (data: { taskId: string, progress: number }) => void
  'message:data': (data: { messages: CoreMessage[] }) => void
}

export interface FetchMessageOpts {
  chatId: string
  pagination: CorePagination

  startTime?: Date
  endTime?: Date

  // Filter
  skipMedia?: boolean
  messageTypes?: string[]

  // Incremental export
  minId?: number
  maxId?: number
}

// ============================================================================
// Dialog Events
// ============================================================================

export interface DialogEventToCore {
  'dialog:fetch': () => void
  /**
   * Request fetching a single dialog's avatar immediately.
   * Used by frontend to prioritize avatars within viewport.
   */
  'dialog:avatar:fetch': (data: { chatId: number | string }) => void
}

export interface DialogEventFromCore {
  'dialog:data': (data: { dialogs: CoreDialog[] }) => void
  /**
   * Emit avatar bytes for a single dialog. Frontend should convert bytes to blobUrl
   * and attach it to the corresponding chat. This event is incremental and small-sized.
   */
  'dialog:avatar:data': (data: { chatId: number, byte: Uint8Array | { data: number[] }, mimeType: string, fileId?: string }) => void
}

// ============================================================================
// Entity Events
// ============================================================================

export interface EntityEventToCore {
  /**
   * Lazy fetch of a user's avatar by userId. Core should respond with 'entity:avatar:data'.
   * Optional fileId allows core to check cache before fetching.
   */
  'entity:avatar:fetch': (data: { userId: string, fileId?: string }) => void
  /**
   * Prime the core LRU cache with fileId information from frontend IndexedDB.
   * This allows fileId-based cache validation without requiring entity fetch.
   */
  'entity:avatar:prime-cache': (data: { userId: string, fileId: string }) => void
  /**
   * Prime the core LRU cache with chat avatar fileId information from frontend IndexedDB.
   * This allows fileId-based cache validation without requiring entity fetch.
   */
  'entity:chat-avatar:prime-cache': (data: { chatId: string, fileId: string }) => void
}

export interface EntityEventFromCore {
  'entity:me:data': (data: CoreUserEntity) => void
  /**
   * Emit avatar bytes for a single user. Frontend converts to blobUrl and caches.
   */
  'entity:avatar:data': (data: { userId: string, byte: Uint8Array | { data: number[] }, mimeType: string, fileId?: string }) => void
}

export interface CoreBaseEntity {
  id: string
  name: string
}

export interface CoreUserEntity extends CoreBaseEntity {
  type: 'user'
  username: string
}

export interface CoreChatEntity extends CoreBaseEntity {
  type: 'chat'
}

export interface CoreChannelEntity extends CoreBaseEntity {
  type: 'channel'
}

export type CoreEntity = CoreUserEntity | CoreChatEntity | CoreChannelEntity

// ============================================================================
// Storage Events
// ============================================================================

export interface StorageEventToCore {
  'storage:fetch:messages': (data: { chatId: string, pagination: CorePagination }) => void
  'storage:record:messages': (data: { messages: CoreMessage[] }) => void

  'storage:fetch:dialogs': (data: { accountId: string }) => void
  'storage:record:dialogs': (data: { dialogs: CoreDialog[], accountId: string }) => void

  'storage:search:messages': (data: CoreMessageSearchParams) => void

  'storage:fetch:message-context': (data: StorageMessageContextParams) => void
}

export interface StorageEventFromCore {
  'storage:messages': (data: { messages: CoreMessage[] }) => void

  'storage:dialogs': (data: { dialogs: CoreDialog[] }) => void

  'storage:search:messages:data': (data: { messages: CoreRetrievalMessages[] }) => void

  'storage:messages:context': (data: { messages: CoreMessage[] } & StorageMessageContextParams) => void
}

export interface CoreMessageSearchParams {
  chatId?: string
  content: string

  useVector: boolean
  pagination?: CorePagination

  // Additional filters for RAG
  chatIds?: string[] // Filter by specific chats
  fromUserId?: string // Filter by user who sent the message
  timeRange?: {
    start?: number // Unix timestamp in seconds
    end?: number // Unix timestamp in seconds
  }
}

export type CoreRetrievalMessages = CoreMessage & {
  similarity?: number
  timeRelevance?: number
  combinedScore?: number
  chatName?: string
}

export interface StorageMessageContextParams {
  chatId: string
  messageId: string
  before?: number
  after?: number
}

// ============================================================================
// Takeout Events
// ============================================================================

export interface SyncOptions {
  // Whether to sync media files
  syncMedia?: boolean
  // Maximum size for media files in MB (0 = unlimited)
  maxMediaSize?: number
  // Time range for sync
  startTime?: Date
  endTime?: Date
  // Message ID range for sync
  minMessageId?: number
  maxMessageId?: number
}

export interface TakeoutEventToCore {
  'takeout:run': (data: { chatIds: string[], increase?: boolean, syncOptions?: SyncOptions }) => void
  'takeout:task:abort': (data: { taskId: string }) => void
  'takeout:stats:fetch': (data: { chatId: string }) => void
}

export interface ChatSyncStats {
  chatId: string
  totalMessages: number
  syncedMessages: number
  firstMessageId: number
  latestMessageId: number
  oldestMessageDate?: Date
  newestMessageDate?: Date
  syncedRanges: Array<{ start: number, end: number }>
}

export interface TakeoutEventFromCore {
  'takeout:task:progress': (data: CoreTaskData<'takeout'>) => void
  'takeout:stats:data': (data: ChatSyncStats) => void
}

export interface TakeoutOpts {
  chatId: string
  pagination: CorePagination

  startTime?: Date
  endTime?: Date

  // Filter
  skipMedia?: boolean
  messageTypes?: string[]

  // Incremental export
  minId?: number
  maxId?: number

  // Expected total count for progress calculation (optional, will fetch from Telegram if not provided)
  expectedCount?: number

  // Disable auto progress emission (for manual progress management in handler)
  disableAutoProgress?: boolean

  // Task object (required, should be created by handler and passed in)
  task: CoreTask<'takeout'>

  // Sync options (media size limit, etc.)
  syncOptions?: SyncOptions
}

// ============================================================================
// Gram Events (Telegram real-time events)
// ============================================================================

export interface GramEventsEventToCore {}

export interface GramEventsEventFromCore {
  'gram:message:received': (data: { message: Api.Message }) => void
}

// ============================================================================
// Message Resolver Events
// ============================================================================

export interface MessageResolverEventToCore {
  /**
   * Processes messages. If `isTakeout` is true, suppresses 'message:data' emissions (browser-facing)
   * while still recording messages to storage. Consumers should be aware that setting `isTakeout`
   * changes event side effects.
   * @param forceRefetch - If true, forces resolvers to skip database cache and re-fetch from source
   */
  'message:process': (data: { messages: Api.Message[], isTakeout?: boolean, syncOptions?: SyncOptions, forceRefetch?: boolean }) => void
  /**
   * Re-processes specific messages to regenerate resolver outputs (e.g., media downloads).
   * Used when media files are missing from storage (404) or when resolver outputs need refreshing.
   *
   * @param chatId - Chat ID containing the messages
   * @param messageIds - Array of message IDs to re-process
   * @param resolvers - Optional array of resolver names to run. **Note:** Currently not implemented;
   *                    all enabled resolvers will run regardless of this parameter. This parameter
   *                    is reserved for future enhancement to support selective resolver execution.
   *                    If omitted or provided, runs all enabled resolvers (not disabled in account settings).
   */
  'message:reprocess': (data: { chatId: string, messageIds: number[], resolvers?: string[] }) => void
}

export interface MessageResolverEventFromCore {}

// ============================================================================
// Aggregated Event Types
// ============================================================================

export type FromCoreEvent = ClientInstanceEventFromCore
  & MessageEventFromCore
  & DialogEventFromCore
  & AccountEventFromCore
  & ConnectionEventFromCore
  & TakeoutEventFromCore
  & SessionEventFromCore
  & EntityEventFromCore
  & StorageEventFromCore
  & AccountSettingsEventFromCore
  & GramEventsEventFromCore
  & MessageResolverEventFromCore

export type ToCoreEvent = ClientInstanceEventToCore
  & MessageEventToCore
  & DialogEventToCore
  & AccountEventToCore
  & ConnectionEventToCore
  & TakeoutEventToCore
  & EntityEventToCore
  & StorageEventToCore
  & AccountSettingsEventToCore
  & GramEventsEventToCore
  & MessageResolverEventToCore

export type CoreEvent = FromCoreEvent & ToCoreEvent

export type CoreEventData<T> = T extends (data: infer D) => void ? D : never

export type CoreEmitter = EventEmitter<CoreEvent>
