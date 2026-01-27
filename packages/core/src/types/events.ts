import type { CorePagination } from '@tg-search/common'
import type { EventEmitter } from 'eventemitter3'
import type { Api } from 'telegram'

import type { AccountSettings } from './account-settings'
import type { CoreChatFolder, CoreDialog } from './dialog'
import type { CoreMessage } from './message'
import type { CoreTask, CoreTaskData } from './task'

export enum CoreEventType {
  CoreCleanup = 'core:cleanup',
  CoreError = 'core:error',

  AuthLogin = 'auth:login',
  AuthLogout = 'auth:logout',
  AuthCode = 'auth:code',
  AuthPassword = 'auth:password',
  AuthCodeNeeded = 'auth:code:needed',
  AuthPasswordNeeded = 'auth:password:needed',
  AuthConnected = 'auth:connected',
  AuthDisconnected = 'auth:disconnected',
  AuthError = 'auth:error',

  SessionUpdate = 'session:update',
  AccountReady = 'account:ready',

  ConfigFetch = 'config:fetch',
  ConfigUpdate = 'config:update',
  ConfigData = 'config:data',

  MessageFetch = 'message:fetch',
  MessageFetchAbort = 'message:fetch:abort',
  MessageFetchSpecific = 'message:fetch:specific',
  MessageFetchUnread = 'message:fetch:unread',
  MessageFetchSummary = 'message:fetch:summary',
  MessageSend = 'message:send',
  MessageRead = 'message:read',
  MessageFetchProgress = 'message:fetch:progress',
  MessageData = 'message:data',
  MessageUnreadData = 'message:unread-data',
  MessageSummaryData = 'message:summary-data',
  MessageProcess = 'message:process',
  MessageReprocess = 'message:reprocess',
  MessageProcessed = 'message:processed',

  DialogFetch = 'dialog:fetch',
  DialogFoldersFetch = 'dialog:folders:fetch',
  DialogAvatarFetch = 'dialog:avatar:fetch',
  DialogData = 'dialog:data',
  DialogFoldersData = 'dialog:folders:data',
  DialogAvatarData = 'dialog:avatar:data',

  EntityProcess = 'entity:process',
  EntityAvatarFetch = 'entity:avatar:fetch',
  EntityAvatarPrimeCache = 'entity:avatar:prime-cache',
  EntityChatAvatarPrimeCache = 'entity:chat-avatar:prime-cache',
  EntityMeData = 'entity:me:data',
  EntityAvatarData = 'entity:avatar:data',

  StorageFetchMessages = 'storage:fetch:messages',
  StorageRecordMessages = 'storage:record:messages',
  StorageFetchDialogs = 'storage:fetch:dialogs',
  StorageRecordDialogs = 'storage:record:dialogs',
  StorageRecordChatFolders = 'storage:record:chat-folders',
  StorageSearchMessages = 'storage:search:messages',
  StorageFetchMessageContext = 'storage:fetch:message-context',
  StorageMessages = 'storage:messages',
  StorageDialogs = 'storage:dialogs',
  StorageSearchMessagesData = 'storage:search:messages:data',
  StorageMessagesContext = 'storage:messages:context',

  TakeoutRun = 'takeout:run',
  TakeoutTaskAbort = 'takeout:task:abort',
  TakeoutStatsFetch = 'takeout:stats:fetch',
  TakeoutTaskProgress = 'takeout:task:progress',
  TakeoutStatsData = 'takeout:stats:data',
  TakeoutMetrics = 'takeout:metrics',

  GramMessageReceived = 'gram:message:received',

  SyncCatchUp = 'sync:catch-up',
  SyncReset = 'sync:reset',
  SyncStatus = 'sync:status',
}

// ============================================================================
// Instance Events
// ============================================================================

export interface ClientInstanceEventToCore {
  [CoreEventType.CoreCleanup]: () => void
}

export interface ClientInstanceEventFromCore {
  [CoreEventType.CoreError]: (data: { error: string, description?: string }) => void
}

// ============================================================================
// Connection Events (auth)
// ============================================================================

export interface ConnectionEventToCore {
  [CoreEventType.AuthLogin]: (data: { phoneNumber?: string, session?: string }) => void
  [CoreEventType.AuthLogout]: () => void
  [CoreEventType.AuthCode]: (data: { code: string }) => void
  [CoreEventType.AuthPassword]: (data: { password: string }) => void
}

export interface ConnectionEventFromCore {
  [CoreEventType.AuthCodeNeeded]: () => void
  [CoreEventType.AuthPasswordNeeded]: () => void
  [CoreEventType.AuthConnected]: () => void
  [CoreEventType.AuthDisconnected]: () => void
  [CoreEventType.AuthError]: () => void
}

// ============================================================================
// Session Events
// ============================================================================

export interface SessionEventToCore {}

export interface SessionEventFromCore {
  [CoreEventType.SessionUpdate]: (data: { session: string }) => void
}

// ============================================================================
// Account Events
// ============================================================================

export interface AccountEventToCore {}

export interface AccountEventFromCore {
  [CoreEventType.AccountReady]: (data: { accountId: string }) => void
}

// ============================================================================
// Account Settings Events
// ============================================================================

export interface AccountSettingsEventToCore {
  [CoreEventType.ConfigFetch]: () => void
  [CoreEventType.ConfigUpdate]: (data: { accountSettings: AccountSettings }) => void
}

export interface AccountSettingsEventFromCore {
  [CoreEventType.ConfigData]: (data: { accountSettings: AccountSettings }) => void
}

// ============================================================================
// Message Events
// ============================================================================

export interface MessageEventToCore {
  [CoreEventType.MessageFetch]: (data: FetchMessageOpts) => void
  [CoreEventType.MessageFetchAbort]: (data: { taskId: string }) => void
  [CoreEventType.MessageFetchSpecific]: (data: { chatId: string, messageIds: number[] }) => void
  [CoreEventType.MessageFetchUnread]: (data: FetchUnreadMessageOpts) => void
  [CoreEventType.MessageFetchSummary]: (data: FetchSummaryMessageOpts) => void
  [CoreEventType.MessageSend]: (data: { chatId: string, content: string }) => void
  [CoreEventType.MessageRead]: (data: { chatId: string }) => void
}

export interface FetchUnreadMessageOpts {
  chatId: string
  limit?: number
  startTime?: number
}

export type SummaryMode = 'unread' | 'today' | 'last24h'

export interface FetchSummaryMessageOpts {
  chatId: string
  mode: SummaryMode
  /**
   * Hard cap to protect WS payload size and LLM token usage.
   */
  limit?: number
}

export interface MessageEventFromCore {
  [CoreEventType.MessageFetchProgress]: (data: { taskId: string, progress: number }) => void
  [CoreEventType.MessageData]: (data: { messages: CoreMessage[] }) => void
  [CoreEventType.MessageUnreadData]: (data: { messages: CoreMessage[] }) => void
  [CoreEventType.MessageSummaryData]: (data: { messages: CoreMessage[], mode: SummaryMode }) => void
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
  [CoreEventType.DialogFetch]: () => void
  [CoreEventType.DialogFoldersFetch]: () => void
  /**
   * Request fetching a single dialog's avatar immediately.
   * Used by frontend to prioritize avatars within viewport.
   */
  [CoreEventType.DialogAvatarFetch]: (data: { chatId: number | string }) => void
}

export interface DialogEventFromCore {
  [CoreEventType.DialogData]: (data: { dialogs: CoreDialog[] }) => void
  [CoreEventType.DialogFoldersData]: (data: { folders: CoreChatFolder[] }) => void
  /**
   * Emit avatar bytes for a single dialog. Frontend should convert bytes to blobUrl
   * and attach it to the corresponding chat. This event is incremental and small-sized.
   */
  [CoreEventType.DialogAvatarData]: (data: { chatId: number, byte: Uint8Array | { data: number[] }, mimeType: string, fileId?: string }) => void
}

// ============================================================================
// Entity Events
// ============================================================================

export interface EntityEventToCore {
  /**
   * Internal event to process multiple users/chats and save them to cache/DB.
   */
  [CoreEventType.EntityProcess]: (data: { users: Api.TypeUser[], chats: Api.TypeChat[] }) => void
  /**
   * Lazy fetch of a user's avatar by userId. Core should respond with CoreEventType.EntityAvatarData.
   * Optional fileId allows core to check cache before fetching.
   */
  [CoreEventType.EntityAvatarFetch]: (data: { userId: string, fileId?: string }) => void
  /**
   * Prime the core LRU cache with fileId information from frontend IndexedDB.
   * This allows fileId-based cache validation without requiring entity fetch.
   */
  [CoreEventType.EntityAvatarPrimeCache]: (data: { userId: string, fileId: string }) => void
  /**
   * Prime the core LRU cache with chat avatar fileId information from frontend IndexedDB.
   * This allows fileId-based cache validation without requiring entity fetch.
   */
  [CoreEventType.EntityChatAvatarPrimeCache]: (data: { chatId: string, fileId: string }) => void
}

export interface EntityEventFromCore {
  [CoreEventType.EntityMeData]: (data: CoreUserEntity) => void
  /**
   * Emit avatar bytes for a single user. Frontend converts to blobUrl and caches.
   */
  [CoreEventType.EntityAvatarData]: (data: { userId: string, byte: Uint8Array | { data: number[] }, mimeType: string, fileId?: string }) => void
}

export interface CoreBaseEntity {
  id: string
  name: string
  accessHash?: string
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
  [CoreEventType.StorageFetchMessages]: (data: { chatId: string, pagination: CorePagination }) => void
  [CoreEventType.StorageRecordMessages]: (data: { messages: CoreMessage[] }) => void

  [CoreEventType.StorageFetchDialogs]: (data: { accountId: string }) => void
  [CoreEventType.StorageRecordDialogs]: (data: { dialogs: CoreDialog[], accountId: string }) => void
  [CoreEventType.StorageRecordChatFolders]: (data: { folders: CoreChatFolder[], accountId: string }) => void

  [CoreEventType.StorageSearchMessages]: (data: CoreMessageSearchParams) => void

  [CoreEventType.StorageFetchMessageContext]: (data: StorageMessageContextParams) => void
}

export interface StorageEventFromCore {
  [CoreEventType.StorageMessages]: (data: { messages: CoreMessage[] }) => void

  [CoreEventType.StorageDialogs]: (data: { dialogs: CoreDialog[] }) => void

  [CoreEventType.StorageSearchMessagesData]: (data: { messages: CoreRetrievalMessages[] }) => void

  [CoreEventType.StorageMessagesContext]: (data: { messages: CoreMessage[] } & StorageMessageContextParams) => void
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

  // Anti-ban / Performance flags
  skipMedia?: boolean
  skipEmbedding?: boolean
  skipJieba?: boolean
}

export interface TakeoutEventToCore {
  [CoreEventType.TakeoutRun]: (data: { chatIds: string[], increase?: boolean, syncOptions?: SyncOptions }) => void
  [CoreEventType.TakeoutTaskAbort]: (data: { taskId: string }) => void
  [CoreEventType.TakeoutStatsFetch]: (data: { chatId: string }) => void
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

export interface TakeoutMetrics {
  taskId: string
  downloadSpeed: number // messages/sec
  processSpeed: number // messages/sec
  processedCount: number
  totalCount: number
  resolverSpans: Array<{
    name: string
    duration: number
    count: number
  }>
}

export interface TakeoutEventFromCore {
  [CoreEventType.TakeoutTaskProgress]: (data: CoreTaskData<'takeout'>) => void
  [CoreEventType.TakeoutStatsData]: (data: ChatSyncStats) => void
  [CoreEventType.TakeoutMetrics]: (data: TakeoutMetrics) => void
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
  [CoreEventType.GramMessageReceived]: (data: { message: Api.Message, pts?: number, date?: number, isChannel: boolean }) => void
}

// ============================================================================
// Message Resolver Events
// ============================================================================

export interface MessageResolverEventToCore {
  /**
   * Processes messages. If `isTakeout` is true, suppresses CoreEventType.MessageData emissions (browser-facing)
   * while still recording messages to storage. Consumers should be aware that setting `isTakeout`
   * changes event side effects.
   * @param forceRefetch - If true, forces resolvers to skip database cache and re-fetch from source
   * @param batchId - Optional unique identifier for the batch to track completion
   */
  [CoreEventType.MessageProcess]: (data: {
    messages: Api.Message[]
    isTakeout?: boolean
    syncOptions?: SyncOptions
    forceRefetch?: boolean
    batchId?: string
  }) => void
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
  [CoreEventType.MessageReprocess]: (data: { chatId: string, messageIds: number[], resolvers?: string[] }) => void
}

export interface MessageResolverEventFromCore {
  [CoreEventType.MessageProcessed]: (data: {
    batchId: string
    count: number
    resolverSpans: Array<{
      name: string
      duration: number
      count: number
    }>
  }) => void
}

// ============================================================================
// Sync Events (PTS/QTS State Machine)
// ============================================================================

export interface SyncEventToCore {
  [CoreEventType.SyncCatchUp]: () => void
  [CoreEventType.SyncReset]: () => void
}

export interface SyncEventFromCore {
  [CoreEventType.SyncStatus]: (data: { status: 'idle' | 'syncing' | 'error', progress?: number }) => void
}

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
  & SyncEventFromCore

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
  & SyncEventToCore

export type CoreEvent = FromCoreEvent & ToCoreEvent

export type ExtractData<T> = (T extends (data: infer D) => void ? D : never)

export interface CoreEventMeta {
  tracingId: string
}

export type CoreEmitter = EventEmitter<CoreEvent>
