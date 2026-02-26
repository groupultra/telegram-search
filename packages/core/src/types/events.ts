import type { Eventa } from '@moeru/eventa'
import type { CorePagination } from '@tg-search/common'
import type { Api } from 'telegram'

import type { AccountSettings } from './account-settings'
import type { CoreChatFolder, CoreDialog } from './dialog'
import type { CoreMessage } from './message'
import type { CoreTask, CoreTaskData } from './task'

import { defineEventa } from '@moeru/eventa'

// ============================================================================
// Helper types
// ============================================================================

export type EventaPayload<E> = E extends Eventa<infer P> ? P : never

/**
 * Eventa with literal string ID type preserved.
 * This allows TypeScript to derive properly-keyed payload maps for WS bridge.
 */
export type TypedEventa<P, Id extends string = string> = Eventa<P> & { readonly id: Id }

/**
 * Wrapper around `defineEventa` that preserves the literal string ID type.
 */
function defineEvent<P = undefined, Id extends string = string>(id: Id): TypedEventa<P, Id> {
  return defineEventa<P>(id) as TypedEventa<P, Id>
}

// ============================================================================
// Instance Events
// ============================================================================

export const CoreCleanup = defineEvent<undefined>('core:cleanup')
export const CoreError = defineEvent<{ error: string, description?: string }>('core:error')

// ============================================================================
// Auth Events
// ============================================================================

export const AuthLogin = defineEvent<{ phoneNumber?: string, session?: string }>('auth:login')
export const AuthLogout = defineEvent<undefined>('auth:logout')
export const AuthCode = defineEvent<{ code: string }>('auth:code')
export const AuthPassword = defineEvent<{ password: string }>('auth:password')
export const AuthCodeNeeded = defineEvent<undefined>('auth:code:needed')
export const AuthPasswordNeeded = defineEvent<undefined>('auth:password:needed')
export const AuthConnected = defineEvent<undefined>('auth:connected')
export const AuthDisconnected = defineEvent<undefined>('auth:disconnected')
export const AuthError = defineEvent<undefined>('auth:error')

// ============================================================================
// Session Events
// ============================================================================

export const SessionUpdate = defineEvent<{ session: string }>('session:update')

// ============================================================================
// Account Events
// ============================================================================

export const AccountReady = defineEvent<{ accountId: string }>('account:ready')

// ============================================================================
// Account Settings Events
// ============================================================================

export const ConfigFetch = defineEvent<undefined>('config:fetch')
export const ConfigUpdate = defineEvent<{ accountSettings: AccountSettings }>('config:update')
export const ConfigData = defineEvent<{ accountSettings: AccountSettings }>('config:data')

// ============================================================================
// Message Events
// ============================================================================

export interface FetchMessageOpts {
  chatId: string
  pagination: CorePagination

  // Unix timestamp in milliseconds
  startTime?: number
  // Unix timestamp in milliseconds
  endTime?: number

  // Filter
  skipMedia?: boolean
  messageTypes?: string[]

  // Incremental export
  minId?: number
  maxId?: number
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
  requestId?: string
  /**
   * Hard cap to protect WS payload size and LLM token usage.
   */
  limit?: number
}

export const MessageFetch = defineEvent<FetchMessageOpts>('message:fetch')
export const MessageFetchAbort = defineEvent<{ taskId: string }>('message:fetch:abort')
export const MessageFetchSpecific = defineEvent<{ chatId: string, messageIds: number[] }>('message:fetch:specific')
export const MessageFetchUnread = defineEvent<FetchUnreadMessageOpts>('message:fetch:unread')
export const MessageFetchSummary = defineEvent<FetchSummaryMessageOpts>('message:fetch:summary')
export const MessageSend = defineEvent<{ chatId: string, content: string }>('message:send')
export const MessageRead = defineEvent<{ chatId: string }>('message:read')
export const MessageFetchProgress = defineEvent<{ taskId: string, progress: number }>('message:fetch:progress')
export const MessageData = defineEvent<{ messages: CoreMessage[] }>('message:data')
export const MessageUnreadData = defineEvent<{ messages: CoreMessage[] }>('message:unread-data')
export const MessageSummaryData = defineEvent<{ messages: CoreMessage[], mode: SummaryMode, requestId?: string }>('message:summary-data')
export const MessageProcess = defineEvent<{
  messages: Api.Message[]
  isTakeout?: boolean
  syncOptions?: SyncOptions
  forceRefetch?: boolean
  batchId?: string
}>('message:process')
export const MessageReprocess = defineEvent<{ chatId: string, messageIds: number[], resolvers?: string[] }>('message:reprocess')
export const MessageProcessed = defineEvent<{
  batchId: string
  count: number
  resolverSpans: Array<{
    name: string
    duration: number
    count: number
  }>
}>('message:processed')

// ============================================================================
// Dialog Events
// ============================================================================

export const DialogFetch = defineEvent<undefined>('dialog:fetch')
export const DialogFoldersFetch = defineEvent<undefined>('dialog:folders:fetch')
/**
 * Request fetching a single dialog's avatar immediately.
 * Used by frontend to prioritize avatars within viewport.
 */
export const DialogAvatarFetch = defineEvent<{ chatId: number | string }>('dialog:avatar:fetch')
export const DialogData = defineEvent<{ dialogs: CoreDialog[] }>('dialog:data')
export const DialogFoldersData = defineEvent<{ folders: CoreChatFolder[] }>('dialog:folders:data')
/**
 * Emit avatar bytes for a single dialog. Frontend should convert bytes to blobUrl
 * and attach it to the corresponding chat. This event is incremental and small-sized.
 */
export const DialogAvatarData = defineEvent<{ chatId: number, byte: Uint8Array | { data: number[] }, mimeType: string, fileId?: string }>('dialog:avatar:data')
export const DialogNote = defineEvent<undefined>('dialog:note')

// ============================================================================
// Entity Events
// ============================================================================

/**
 * Internal event to process multiple users/chats and save them to cache/DB.
 */
export const EntityProcess = defineEvent<{ users: Api.TypeUser[], chats: Api.TypeChat[] }>('entity:process')
/**
 * Lazy fetch of a user's avatar by userId. Core should respond with EntityAvatarData.
 * Optional fileId allows core to check cache before fetching.
 */
export const EntityAvatarFetch = defineEvent<{ userId: string, fileId?: string }>('entity:avatar:fetch')
/**
 * Prime the core LRU cache with fileId information from frontend IndexedDB.
 * This allows fileId-based cache validation without requiring entity fetch.
 */
export const EntityAvatarPrimeCache = defineEvent<{ userId: string, fileId: string }>('entity:avatar:prime-cache')
/**
 * Prime the core LRU cache with chat avatar fileId information from frontend IndexedDB.
 * This allows fileId-based cache validation without requiring entity fetch.
 */
export const EntityChatAvatarPrimeCache = defineEvent<{ chatId: string, fileId: string }>('entity:chat-avatar:prime-cache')
export const EntityMeData = defineEvent<CoreUserEntity>('entity:me:data')
/**
 * Emit avatar bytes for a single user. Frontend converts to blobUrl and caches.
 */
export const EntityAvatarData = defineEvent<{ userId: string, byte: Uint8Array | { data: number[] }, mimeType: string, fileId?: string }>('entity:avatar:data')

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
  username?: string
}

export type CoreEntity = CoreUserEntity | CoreChatEntity | CoreChannelEntity

// ============================================================================
// Storage Events
// ============================================================================

export const StorageFetchMessages = defineEvent<{ chatId: string, pagination: CorePagination }>('storage:fetch:messages')
export const StorageRecordMessages = defineEvent<{ messages: CoreMessage[] }>('storage:record:messages')
export const StorageFetchDialogs = defineEvent<{ accountId: string }>('storage:fetch:dialogs')
export const StorageRecordDialogs = defineEvent<{ dialogs: CoreDialog[], accountId: string }>('storage:record:dialogs')
export const StorageRecordChatFolders = defineEvent<{ folders: CoreChatFolder[], accountId: string }>('storage:record:chat-folders')
export const StorageSearchMessages = defineEvent<CoreMessageSearchParams>('storage:search:messages')
export const StorageSearchPhotos = defineEvent<CorePhotoSearchParams>('storage:search:photos')
export const StorageFetchMessageContext = defineEvent<StorageMessageContextParams>('storage:fetch:message-context')
export const StorageMessages = defineEvent<{ messages: CoreMessage[] }>('storage:messages')
export const StorageDialogs = defineEvent<{ dialogs: CoreDialog[] }>('storage:dialogs')
export const StorageSearchMessagesData = defineEvent<{ messages: CoreRetrievalMessages[] }>('storage:search:messages:data')
export const StorageSearchPhotosData = defineEvent<{ photos: CoreRetrievalPhoto[] }>('storage:search:photos:data')
export const StorageMessagesContext = defineEvent<{ messages: CoreMessage[] } & StorageMessageContextParams>('storage:messages:context')
export const StorageChatNote = defineEvent<{ chatId: string, note: string, modify: boolean }>('storage:record:dialog-note')
export const StorageChatNoteData = defineEvent<{ chatId: string, note: string }>('storage:dialog-note')

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

export interface CorePhotoSearchParams {
  content: string
  useVector: boolean
  pagination?: CorePagination

  // Additional filters
  chatIds?: string[] // Filter by specific chats
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

export interface CoreRetrievalPhoto {
  id: string
  messageId: string | null
  platformMessageId?: string
  chatId?: string
  chatName?: string
  description: string
  mimeType: string
  imageBytes?: Uint8Array | string
  createdAt: number
  similarity?: number
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
  // Time range for sync (unix timestamp in milliseconds)
  startTime?: number
  endTime?: number
  // Message ID range for sync
  minMessageId?: number
  maxMessageId?: number

  // Anti-ban / Performance flags
  skipMedia?: boolean
  skipEmbedding?: boolean
  skipJieba?: boolean
}

export const TakeoutRun = defineEvent<{ chatIds: string[], increase?: boolean, syncOptions?: SyncOptions }>('takeout:run')
export const TakeoutTaskAbort = defineEvent<{ taskId: string }>('takeout:task:abort')
export const TakeoutStatsFetch = defineEvent<{ chatId: string }>('takeout:stats:fetch')
export const TakeoutTaskProgress = defineEvent<CoreTaskData<'takeout'>>('takeout:task:progress')
export const TakeoutStatsData = defineEvent<ChatSyncStats>('takeout:stats:data')
export const TakeoutMetrics = defineEvent<TakeoutMetricsData>('takeout:metrics')

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

export interface TakeoutMetricsData {
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

export interface TakeoutOpts {
  chatId: string
  pagination: CorePagination

  // Unix timestamp in milliseconds
  startTime?: number
  // Unix timestamp in milliseconds
  endTime?: number

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

export const GramMessageReceived = defineEvent<{ message: Api.Message, pts?: number, date?: number, isChannel: boolean }>('gram:message:received')

// ============================================================================
// Bot Events (Grammy Bot API bridge)
// ============================================================================

export const BotSendMessage = defineEvent<{
  chatId: string
  content: string
  parseMode?: 'HTML' | 'MarkdownV2'
}>('bot:send:message')
export const BotStatus = defineEvent<{
  status: 'connected' | 'disconnected' | 'error'
  botUsername?: string
}>('bot:status')

// ============================================================================
// Sync Events (PTS/QTS State Machine)
// ============================================================================

export const SyncCatchUp = defineEvent<undefined>('sync:catch-up')
export const SyncReset = defineEvent<undefined>('sync:reset')
export const SyncStatus = defineEvent<{ status: 'idle' | 'syncing' | 'error', progress?: number }>('sync:status')

// ============================================================================
// Aggregated Event Namespaces
// ============================================================================

/**
 * Events emitted FROM core TO clients (server → client direction).
 */
export const FromCoreEvents = {
  CoreError,
  AuthCodeNeeded,
  AuthPasswordNeeded,
  AuthConnected,
  AuthDisconnected,
  AuthError,
  SessionUpdate,
  AccountReady,
  ConfigData,
  MessageFetchProgress,
  MessageData,
  MessageUnreadData,
  MessageSummaryData,
  MessageProcessed,
  DialogData,
  DialogFoldersData,
  DialogAvatarData,
  EntityMeData,
  EntityAvatarData,
  StorageMessages,
  StorageDialogs,
  StorageSearchMessagesData,
  StorageSearchPhotosData,
  StorageMessagesContext,
  StorageChatNoteData,
  TakeoutTaskProgress,
  TakeoutStatsData,
  TakeoutMetrics,
  GramMessageReceived,
  BotStatus,
  SyncStatus,
} as const

/**
 * Events sent TO core FROM clients (client → server direction).
 */
export const ToCoreEvents = {
  CoreCleanup,
  AuthLogin,
  AuthLogout,
  AuthCode,
  AuthPassword,
  ConfigFetch,
  ConfigUpdate,
  MessageFetch,
  MessageFetchAbort,
  MessageFetchSpecific,
  MessageFetchUnread,
  MessageFetchSummary,
  MessageSend,
  MessageRead,
  MessageProcess,
  MessageReprocess,
  DialogFetch,
  DialogFoldersFetch,
  DialogAvatarFetch,
  EntityProcess,
  EntityAvatarFetch,
  EntityAvatarPrimeCache,
  EntityChatAvatarPrimeCache,
  StorageFetchMessages,
  StorageRecordMessages,
  StorageFetchDialogs,
  StorageRecordDialogs,
  StorageRecordChatFolders,
  StorageSearchMessages,
  StorageSearchPhotos,
  StorageFetchMessageContext,
  StorageChatNote,
  TakeoutRun,
  TakeoutTaskAbort,
  TakeoutStatsFetch,
  BotSendMessage,
  SyncCatchUp,
  SyncReset,
} as const

/**
 * All core events (both directions).
 */
export const CoreEvents = {
  ...FromCoreEvents,
  ...ToCoreEvents,
} as const

// ============================================================================
// Backward-Compatible CoreEventType (string ID lookup)
// ============================================================================

/**
 * Backward-compatible enum-like const for string-based event ID lookup.
 * Maps event names to their string IDs (e.g., `CoreEventType.AuthLogin === 'auth:login'`).
 * Used by WebSocket bridge and client for serialization.
 *
 * Defined explicitly (not derived) to preserve literal string types through DTS bundling.
 */
export const CoreEventType = {
  // Instance
  CoreCleanup: 'core:cleanup',
  CoreError: 'core:error',
  // Auth
  AuthLogin: 'auth:login',
  AuthLogout: 'auth:logout',
  AuthCode: 'auth:code',
  AuthPassword: 'auth:password', // eslint-disable-line sonarjs/no-hardcoded-passwords -- event ID, not a password
  AuthCodeNeeded: 'auth:code:needed',
  AuthPasswordNeeded: 'auth:password:needed', // eslint-disable-line sonarjs/no-hardcoded-passwords -- event ID, not a password
  AuthConnected: 'auth:connected',
  AuthDisconnected: 'auth:disconnected',
  AuthError: 'auth:error',
  // Session
  SessionUpdate: 'session:update',
  // Account
  AccountReady: 'account:ready',
  // Account Settings
  ConfigFetch: 'config:fetch',
  ConfigUpdate: 'config:update',
  ConfigData: 'config:data',
  // Message
  MessageFetch: 'message:fetch',
  MessageFetchAbort: 'message:fetch:abort',
  MessageFetchSpecific: 'message:fetch:specific',
  MessageFetchUnread: 'message:fetch:unread',
  MessageFetchSummary: 'message:fetch:summary',
  MessageSend: 'message:send',
  MessageRead: 'message:read',
  MessageFetchProgress: 'message:fetch:progress',
  MessageData: 'message:data',
  MessageUnreadData: 'message:unread-data',
  MessageSummaryData: 'message:summary-data',
  MessageProcess: 'message:process',
  MessageReprocess: 'message:reprocess',
  MessageProcessed: 'message:processed',
  // Dialog
  DialogFetch: 'dialog:fetch',
  DialogFoldersFetch: 'dialog:folders:fetch',
  DialogAvatarFetch: 'dialog:avatar:fetch',
  DialogData: 'dialog:data',
  DialogFoldersData: 'dialog:folders:data',
  DialogAvatarData: 'dialog:avatar:data',
  DialogNote: 'dialog:note',
  // Entity
  EntityProcess: 'entity:process',
  EntityAvatarFetch: 'entity:avatar:fetch',
  EntityAvatarPrimeCache: 'entity:avatar:prime-cache',
  EntityChatAvatarPrimeCache: 'entity:chat-avatar:prime-cache',
  EntityMeData: 'entity:me:data',
  EntityAvatarData: 'entity:avatar:data',
  // Storage
  StorageFetchMessages: 'storage:fetch:messages',
  StorageRecordMessages: 'storage:record:messages',
  StorageFetchDialogs: 'storage:fetch:dialogs',
  StorageRecordDialogs: 'storage:record:dialogs',
  StorageRecordChatFolders: 'storage:record:chat-folders',
  StorageSearchMessages: 'storage:search:messages',
  StorageSearchPhotos: 'storage:search:photos',
  StorageFetchMessageContext: 'storage:fetch:message-context',
  StorageMessages: 'storage:messages',
  StorageDialogs: 'storage:dialogs',
  StorageSearchMessagesData: 'storage:search:messages:data',
  StorageSearchPhotosData: 'storage:search:photos:data',
  StorageMessagesContext: 'storage:messages:context',
  StorageChatNote: 'storage:record:dialog-note',
  StorageChatNoteData: 'storage:dialog-note',
  // Takeout
  TakeoutRun: 'takeout:run',
  TakeoutTaskAbort: 'takeout:task:abort',
  TakeoutStatsFetch: 'takeout:stats:fetch',
  TakeoutTaskProgress: 'takeout:task:progress',
  TakeoutStatsData: 'takeout:stats:data',
  TakeoutMetrics: 'takeout:metrics',
  // Gram Events
  GramMessageReceived: 'gram:message:received',
  // Bot
  BotSendMessage: 'bot:send:message',
  BotStatus: 'bot:status',
  // Sync
  SyncCatchUp: 'sync:catch-up',
  SyncReset: 'sync:reset',
  SyncStatus: 'sync:status',
} as const

// ============================================================================
// WS Bridge Types (explicit interfaces for DTS bundler compatibility)
// ============================================================================

/**
 * Callback-style event map for events emitted FROM core TO clients.
 * Keys are string event IDs, values are callback signatures.
 * Used by WebSocket bridge and client SDK for serialization.
 */
export interface FromCoreEvent {
  'core:error': (data: EventaPayload<typeof CoreError>) => void
  'auth:code:needed': () => void
  'auth:password:needed': () => void
  'auth:connected': () => void
  'auth:disconnected': () => void
  'auth:error': () => void
  'session:update': (data: EventaPayload<typeof SessionUpdate>) => void
  'account:ready': (data: EventaPayload<typeof AccountReady>) => void
  'config:data': (data: EventaPayload<typeof ConfigData>) => void
  'message:fetch:progress': (data: EventaPayload<typeof MessageFetchProgress>) => void
  'message:data': (data: EventaPayload<typeof MessageData>) => void
  'message:unread-data': (data: EventaPayload<typeof MessageUnreadData>) => void
  'message:summary-data': (data: EventaPayload<typeof MessageSummaryData>) => void
  'message:processed': (data: EventaPayload<typeof MessageProcessed>) => void
  'dialog:data': (data: EventaPayload<typeof DialogData>) => void
  'dialog:folders:data': (data: EventaPayload<typeof DialogFoldersData>) => void
  'dialog:avatar:data': (data: EventaPayload<typeof DialogAvatarData>) => void
  'entity:me:data': (data: EventaPayload<typeof EntityMeData>) => void
  'entity:avatar:data': (data: EventaPayload<typeof EntityAvatarData>) => void
  'storage:messages': (data: EventaPayload<typeof StorageMessages>) => void
  'storage:dialogs': (data: EventaPayload<typeof StorageDialogs>) => void
  'storage:search:messages:data': (data: EventaPayload<typeof StorageSearchMessagesData>) => void
  'storage:search:photos:data': (data: EventaPayload<typeof StorageSearchPhotosData>) => void
  'storage:messages:context': (data: EventaPayload<typeof StorageMessagesContext>) => void
  'storage:dialog-note': (data: EventaPayload<typeof StorageChatNoteData>) => void
  'takeout:task:progress': (data: EventaPayload<typeof TakeoutTaskProgress>) => void
  'takeout:stats:data': (data: EventaPayload<typeof TakeoutStatsData>) => void
  'takeout:metrics': (data: EventaPayload<typeof TakeoutMetrics>) => void
  'gram:message:received': (data: EventaPayload<typeof GramMessageReceived>) => void
  'bot:status': (data: EventaPayload<typeof BotStatus>) => void
  'sync:status': (data: EventaPayload<typeof SyncStatus>) => void
}

/**
 * Callback-style event map for events sent TO core FROM clients.
 * Keys are string event IDs, values are callback signatures.
 */
export interface ToCoreEvent {
  'core:cleanup': () => void
  'auth:login': (data: EventaPayload<typeof AuthLogin>) => void
  'auth:logout': () => void
  'auth:code': (data: EventaPayload<typeof AuthCode>) => void
  'auth:password': (data: EventaPayload<typeof AuthPassword>) => void
  'config:fetch': () => void
  'config:update': (data: EventaPayload<typeof ConfigUpdate>) => void
  'message:fetch': (data: EventaPayload<typeof MessageFetch>) => void
  'message:fetch:abort': (data: EventaPayload<typeof MessageFetchAbort>) => void
  'message:fetch:specific': (data: EventaPayload<typeof MessageFetchSpecific>) => void
  'message:fetch:unread': (data: EventaPayload<typeof MessageFetchUnread>) => void
  'message:fetch:summary': (data: EventaPayload<typeof MessageFetchSummary>) => void
  'message:send': (data: EventaPayload<typeof MessageSend>) => void
  'message:read': (data: EventaPayload<typeof MessageRead>) => void
  'message:process': (data: EventaPayload<typeof MessageProcess>) => void
  'message:reprocess': (data: EventaPayload<typeof MessageReprocess>) => void
  'dialog:fetch': () => void
  'dialog:folders:fetch': () => void
  'dialog:avatar:fetch': (data: EventaPayload<typeof DialogAvatarFetch>) => void
  'entity:process': (data: EventaPayload<typeof EntityProcess>) => void
  'entity:avatar:fetch': (data: EventaPayload<typeof EntityAvatarFetch>) => void
  'entity:avatar:prime-cache': (data: EventaPayload<typeof EntityAvatarPrimeCache>) => void
  'entity:chat-avatar:prime-cache': (data: EventaPayload<typeof EntityChatAvatarPrimeCache>) => void
  'storage:fetch:messages': (data: EventaPayload<typeof StorageFetchMessages>) => void
  'storage:record:messages': (data: EventaPayload<typeof StorageRecordMessages>) => void
  'storage:fetch:dialogs': (data: EventaPayload<typeof StorageFetchDialogs>) => void
  'storage:record:dialogs': (data: EventaPayload<typeof StorageRecordDialogs>) => void
  'storage:record:chat-folders': (data: EventaPayload<typeof StorageRecordChatFolders>) => void
  'storage:search:messages': (data: EventaPayload<typeof StorageSearchMessages>) => void
  'storage:search:photos': (data: EventaPayload<typeof StorageSearchPhotos>) => void
  'storage:fetch:message-context': (data: EventaPayload<typeof StorageFetchMessageContext>) => void
  'storage:record:dialog-note': (data: EventaPayload<typeof StorageChatNote>) => void
  'takeout:run': (data: EventaPayload<typeof TakeoutRun>) => void
  'takeout:task:abort': (data: EventaPayload<typeof TakeoutTaskAbort>) => void
  'takeout:stats:fetch': (data: EventaPayload<typeof TakeoutStatsFetch>) => void
  'bot:send:message': (data: EventaPayload<typeof BotSendMessage>) => void
  'sync:catch-up': () => void
  'sync:reset': () => void
}

export type CoreEventAll = FromCoreEvent & ToCoreEvent

/**
 * Payload map for events emitted FROM core TO clients.
 */
export type FromCoreEventPayloadMap = {
  [K in keyof FromCoreEvent]: Parameters<FromCoreEvent[K]>[0]
}

/**
 * Payload map for events sent TO core FROM clients.
 */
export type ToCoreEventPayloadMap = {
  [K in keyof ToCoreEvent]: Parameters<ToCoreEvent[K]>[0]
}

/**
 * Combined payload map for all core events.
 */
export type CoreEventPayloadMap = FromCoreEventPayloadMap & ToCoreEventPayloadMap

// ============================================================================
// Utility: Event ID → Eventa Lookup
// ============================================================================

const _coreEventLookup = new Map<string, Eventa<any>>()
for (const event of Object.values(CoreEvents)) {
  _coreEventLookup.set(event.id, event)
}

/**
 * Look up an Eventa definition by its string event ID.
 * Used by the WebSocket bridge to convert incoming string event types to Eventa objects.
 */
export function getCoreEventById(id: string): Eventa<any> | undefined {
  return _coreEventLookup.get(id)
}

// ============================================================================
// Legacy Type Helpers
// ============================================================================

export type ExtractData<T> = (T extends (data: infer D) => void ? D : never)

export interface CoreEventMeta {
  tracingId: string
}
