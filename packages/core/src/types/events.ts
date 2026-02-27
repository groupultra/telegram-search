import type { Eventa, InvokeEventa } from '@moeru/eventa'
import type { CorePagination } from '@tg-search/common'
import type { Api } from 'telegram'

import type { AccountSettings } from './account-settings'
import type { CoreChatFolder, CoreDialog } from './dialog'
import type { CoreMessage } from './message'
import type { CoreTask, CoreTaskData } from './task'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

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
// Fire-and-Forget Events (one-way notifications / internal signals)
// ============================================================================

// -- Instance ----------------------------------------------------------------

export const CoreCleanup = defineEvent<undefined>('core:cleanup')
export const CoreError = defineEvent<{ error: string, description?: string }>('core:error')

// -- Auth (interactive stateful flow – not simple RPC) -----------------------

export const AuthLogin = defineEvent<{ phoneNumber?: string, session?: string }>('auth:login')
export const AuthLogout = defineEvent<undefined>('auth:logout')
export const AuthCode = defineEvent<{ code: string }>('auth:code')
export const AuthPassword = defineEvent<{ password: string }>('auth:password')
export const AuthCodeNeeded = defineEvent<undefined>('auth:code:needed')
export const AuthPasswordNeeded = defineEvent<undefined>('auth:password:needed')
export const AuthConnected = defineEvent<undefined>('auth:connected')
export const AuthDisconnected = defineEvent<undefined>('auth:disconnected')
export const AuthError = defineEvent<undefined>('auth:error')

// -- Session -----------------------------------------------------------------

export const SessionUpdate = defineEvent<{ session: string }>('session:update')

// -- Account -----------------------------------------------------------------

export const AccountReady = defineEvent<{ accountId: string }>('account:ready')

// -- Message (fire-and-forget actions & internal signals) --------------------

export const MessageFetch = defineEvent<FetchMessageOpts>('message:fetch')
export const MessageFetchAbort = defineEvent<{ taskId: string }>('message:fetch:abort')
export const MessageFetchSpecific = defineEvent<{ chatId: string, messageIds: number[] }>('message:fetch:specific')
export const MessageSend = defineEvent<{ chatId: string, content: string }>('message:send')
export const MessageRead = defineEvent<{ chatId: string }>('message:read')
export const MessageFetchProgress = defineEvent<{ taskId: string, progress: number }>('message:fetch:progress')
export const MessageData = defineEvent<{ messages: CoreMessage[] }>('message:data')
export const MessageReprocess = defineEvent<{ chatId: string, messageIds: number[], resolvers?: string[] }>('message:reprocess')
export const MessageProcess = defineEvent<{
  messages: Api.Message[]
  isTakeout?: boolean
  syncOptions?: SyncOptions
  forceRefetch?: boolean
  batchId?: string
}>('message:process')
export const MessageProcessed = defineEvent<{
  batchId: string
  count: number
  resolverSpans: Array<{
    name: string
    duration: number
    count: number
  }>
}>('message:processed')

// -- Dialog (fire-and-forget actions & broadcasts) ---------------------------

export const DialogAvatarFetch = defineEvent<{ chatId: number | string }>('dialog:avatar:fetch')
/**
 * Emit avatar bytes for a single dialog. Frontend should convert bytes to blobUrl
 * and attach it to the corresponding chat. This event is incremental and small-sized.
 */
export const DialogAvatarData = defineEvent<{ chatId: number, byte: Uint8Array | { data: number[] }, mimeType: string, fileId?: string }>('dialog:avatar:data')
export const DialogNote = defineEvent<undefined>('dialog:note')

// -- Entity (fire-and-forget actions & broadcasts) ---------------------------

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

// -- Storage (internal write events) -----------------------------------------

export const StorageRecordMessages = defineEvent<{ messages: CoreMessage[] }>('storage:record:messages')
export const StorageRecordDialogs = defineEvent<{ dialogs: CoreDialog[], accountId: string }>('storage:record:dialogs')
export const StorageRecordChatFolders = defineEvent<{ folders: CoreChatFolder[], accountId: string }>('storage:record:chat-folders')

// -- Takeout (fire-and-forget actions & streaming progress) ------------------

export const TakeoutRun = defineEvent<{ chatIds: string[], increase?: boolean, syncOptions?: SyncOptions }>('takeout:run')
export const TakeoutTaskAbort = defineEvent<{ taskId: string }>('takeout:task:abort')
export const TakeoutTaskProgress = defineEvent<CoreTaskData<'takeout'>>('takeout:task:progress')
export const TakeoutMetrics = defineEvent<TakeoutMetricsData>('takeout:metrics')

// -- Gram Events (Telegram real-time events) ---------------------------------

export const GramMessageReceived = defineEvent<{ message: Api.Message, pts?: number, date?: number, isChannel: boolean }>('gram:message:received')

// -- Bot Events (Grammy Bot API bridge) --------------------------------------

export const BotSendMessage = defineEvent<{
  chatId: string
  content: string
  parseMode?: 'HTML' | 'MarkdownV2'
}>('bot:send:message')
export const BotStatus = defineEvent<{
  status: 'connected' | 'disconnected' | 'error'
  botUsername?: string
}>('bot:status')

// -- Sync Events (PTS/QTS State Machine) -------------------------------------

export const SyncCatchUp = defineEvent<undefined>('sync:catch-up')
export const SyncReset = defineEvent<undefined>('sync:reset')
export const SyncStatus = defineEvent<{ status: 'idle' | 'syncing' | 'error', progress?: number }>('sync:status')

// ============================================================================
// Invoke Events (RPC request → response via defineInvokeEventa)
// ============================================================================

// -- Config RPC --------------------------------------------------------------

/** Fetch account settings. Response: { accountSettings } */
export const ConfigFetchInvoke = defineInvokeEventa<
  { accountSettings: AccountSettings },
  undefined
>('config:fetch')

/** Update account settings. Request: { accountSettings }, Response: validated { accountSettings } */
export const ConfigUpdateInvoke = defineInvokeEventa<
  { accountSettings: AccountSettings },
  { accountSettings: AccountSettings }
>('config:update')

// -- Message RPC -------------------------------------------------------------

/** Fetch unread messages. */
export const MessageFetchUnreadInvoke = defineInvokeEventa<
  { messages: CoreMessage[] },
  FetchUnreadMessageOpts
>('message:fetch:unread')

/** Fetch messages for summary (unread/today/last24h). */
export const MessageFetchSummaryInvoke = defineInvokeEventa<
  { messages: CoreMessage[], mode: SummaryMode, requestId?: string },
  FetchSummaryMessageOpts
>('message:fetch:summary')

// -- Dialog RPC --------------------------------------------------------------

/** Fetch all dialogs. */
export const DialogFetchInvoke = defineInvokeEventa<
  { dialogs: CoreDialog[] },
  undefined
>('dialog:fetch')

/** Fetch chat folders. */
export const DialogFoldersFetchInvoke = defineInvokeEventa<
  { folders: CoreChatFolder[] },
  undefined
>('dialog:folders:fetch')

// -- Storage RPC -------------------------------------------------------------

/** Fetch messages from local DB. */
export const StorageFetchMessagesInvoke = defineInvokeEventa<
  { messages: CoreMessage[] },
  { chatId: string, pagination: CorePagination }
>('storage:fetch:messages')

/** Fetch dialogs from local DB. */
export const StorageFetchDialogsInvoke = defineInvokeEventa<
  { dialogs: CoreDialog[] },
  { accountId: string }
>('storage:fetch:dialogs')

/** Search messages (text or vector). */
export const StorageSearchMessagesInvoke = defineInvokeEventa<
  { messages: CoreRetrievalMessages[] },
  CoreMessageSearchParams
>('storage:search:messages')

/** Search photos (text or vector). */
export const StorageSearchPhotosInvoke = defineInvokeEventa<
  { photos: CoreRetrievalPhoto[] },
  CorePhotoSearchParams
>('storage:search:photos')

/** Fetch message context (surrounding messages). */
export const StorageFetchMessageContextInvoke = defineInvokeEventa<
  { messages: CoreMessage[] } & StorageMessageContextParams,
  StorageMessageContextParams
>('storage:fetch:message-context')

/** Save/modify chat note. */
export const StorageChatNoteInvoke = defineInvokeEventa<
  { chatId: string, note: string },
  { chatId: string, note: string, modify: boolean }
>('storage:record:dialog-note')

// -- Takeout RPC -------------------------------------------------------------

/** Fetch sync stats for a chat. */
export const TakeoutStatsFetchInvoke = defineInvokeEventa<
  ChatSyncStats,
  { chatId: string }
>('takeout:stats:fetch')

// ============================================================================
// Invoke Event Configuration (for WS bridge mapping)
// ============================================================================

/**
 * Maps incoming WS request event IDs to their corresponding InvokeEventa
 * definitions and the outgoing WS response event IDs.
 *
 * Used by the WS bridge to translate between WS string protocol and Eventa invoke.
 */
export const invokeEventConfig: Record<string, { event: InvokeEventa<any, any>, responseEventId: string }> = {
  'config:fetch': { event: ConfigFetchInvoke, responseEventId: 'config:data' },
  'config:update': { event: ConfigUpdateInvoke, responseEventId: 'config:data' },
  'message:fetch:unread': { event: MessageFetchUnreadInvoke, responseEventId: 'message:unread-data' },
  'message:fetch:summary': { event: MessageFetchSummaryInvoke, responseEventId: 'message:summary-data' },
  'dialog:fetch': { event: DialogFetchInvoke, responseEventId: 'dialog:data' },
  'dialog:folders:fetch': { event: DialogFoldersFetchInvoke, responseEventId: 'dialog:folders:data' },
  'storage:fetch:messages': { event: StorageFetchMessagesInvoke, responseEventId: 'storage:messages' },
  'storage:fetch:dialogs': { event: StorageFetchDialogsInvoke, responseEventId: 'storage:dialogs' },
  'storage:search:messages': { event: StorageSearchMessagesInvoke, responseEventId: 'storage:search:messages:data' },
  'storage:search:photos': { event: StorageSearchPhotosInvoke, responseEventId: 'storage:search:photos:data' },
  'storage:fetch:message-context': { event: StorageFetchMessageContextInvoke, responseEventId: 'storage:messages:context' },
  'storage:record:dialog-note': { event: StorageChatNoteInvoke, responseEventId: 'storage:dialog-note' },
  'takeout:stats:fetch': { event: TakeoutStatsFetchInvoke, responseEventId: 'takeout:stats:data' },
}

// ============================================================================
// Shared Type Definitions
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
// Aggregated Event Namespaces
// ============================================================================

/**
 * All invoke event definitions (RPC events).
 */
export const InvokeEvents = {
  ConfigFetch: ConfigFetchInvoke,
  ConfigUpdate: ConfigUpdateInvoke,
  MessageFetchUnread: MessageFetchUnreadInvoke,
  MessageFetchSummary: MessageFetchSummaryInvoke,
  DialogFetch: DialogFetchInvoke,
  DialogFoldersFetch: DialogFoldersFetchInvoke,
  StorageFetchMessages: StorageFetchMessagesInvoke,
  StorageFetchDialogs: StorageFetchDialogsInvoke,
  StorageSearchMessages: StorageSearchMessagesInvoke,
  StorageSearchPhotos: StorageSearchPhotosInvoke,
  StorageFetchMessageContext: StorageFetchMessageContextInvoke,
  StorageChatNote: StorageChatNoteInvoke,
  TakeoutStatsFetch: TakeoutStatsFetchInvoke,
} as const

/**
 * Events emitted FROM core TO clients (server → client direction).
 * Includes broadcast notifications. Invoke responses are sent directly by the bridge.
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
  MessageFetchProgress,
  MessageData,
  MessageProcessed,
  DialogAvatarData,
  EntityMeData,
  EntityAvatarData,
  TakeoutTaskProgress,
  TakeoutMetrics,
  GramMessageReceived,
  BotStatus,
  SyncStatus,
} as const

/**
 * Events sent TO core FROM clients (client → server direction).
 * Only fire-and-forget events. Invoke requests are handled by InvokeEvents.
 */
export const ToCoreEvents = {
  CoreCleanup,
  AuthLogin,
  AuthLogout,
  AuthCode,
  AuthPassword,
  MessageFetch,
  MessageFetchAbort,
  MessageFetchSpecific,
  MessageSend,
  MessageRead,
  MessageProcess,
  MessageReprocess,
  DialogAvatarFetch,
  EntityProcess,
  EntityAvatarFetch,
  EntityAvatarPrimeCache,
  EntityChatAvatarPrimeCache,
  StorageRecordMessages,
  StorageRecordDialogs,
  StorageRecordChatFolders,
  TakeoutRun,
  TakeoutTaskAbort,
  BotSendMessage,
  SyncCatchUp,
  SyncReset,
} as const

/**
 * All fire-and-forget events (both directions).
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
  // Config (invoke)
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
 * Includes both broadcast events and invoke response types (for WS protocol compat).
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
  // Invoke responses (sent by bridge after invoke, not as Eventa events)
  'config:data': (data: { accountSettings: AccountSettings }) => void
  'message:fetch:progress': (data: EventaPayload<typeof MessageFetchProgress>) => void
  'message:data': (data: EventaPayload<typeof MessageData>) => void
  'message:unread-data': (data: { messages: CoreMessage[] }) => void
  'message:summary-data': (data: { messages: CoreMessage[], mode: SummaryMode, requestId?: string }) => void
  'message:processed': (data: EventaPayload<typeof MessageProcessed>) => void
  // Invoke responses
  'dialog:data': (data: { dialogs: CoreDialog[] }) => void
  'dialog:folders:data': (data: { folders: CoreChatFolder[] }) => void
  'dialog:avatar:data': (data: EventaPayload<typeof DialogAvatarData>) => void
  'entity:me:data': (data: EventaPayload<typeof EntityMeData>) => void
  'entity:avatar:data': (data: EventaPayload<typeof EntityAvatarData>) => void
  // Invoke responses
  'storage:messages': (data: { messages: CoreMessage[] }) => void
  'storage:dialogs': (data: { dialogs: CoreDialog[] }) => void
  'storage:search:messages:data': (data: { messages: CoreRetrievalMessages[] }) => void
  'storage:search:photos:data': (data: { photos: CoreRetrievalPhoto[] }) => void
  'storage:messages:context': (data: { messages: CoreMessage[] } & StorageMessageContextParams) => void
  'storage:dialog-note': (data: { chatId: string, note: string }) => void
  'takeout:task:progress': (data: EventaPayload<typeof TakeoutTaskProgress>) => void
  'takeout:stats:data': (data: ChatSyncStats) => void
  'takeout:metrics': (data: EventaPayload<typeof TakeoutMetrics>) => void
  'gram:message:received': (data: EventaPayload<typeof GramMessageReceived>) => void
  'bot:status': (data: EventaPayload<typeof BotStatus>) => void
  'sync:status': (data: EventaPayload<typeof SyncStatus>) => void
}

/**
 * Callback-style event map for events sent TO core FROM clients.
 * Includes both fire-and-forget events and invoke request types (for WS protocol compat).
 */
export interface ToCoreEvent {
  'core:cleanup': () => void
  'auth:login': (data: EventaPayload<typeof AuthLogin>) => void
  'auth:logout': () => void
  'auth:code': (data: EventaPayload<typeof AuthCode>) => void
  'auth:password': (data: EventaPayload<typeof AuthPassword>) => void
  // Invoke requests
  'config:fetch': () => void
  'config:update': (data: { accountSettings: AccountSettings }) => void
  'message:fetch': (data: EventaPayload<typeof MessageFetch>) => void
  'message:fetch:abort': (data: EventaPayload<typeof MessageFetchAbort>) => void
  'message:fetch:specific': (data: EventaPayload<typeof MessageFetchSpecific>) => void
  'message:fetch:unread': (data: FetchUnreadMessageOpts) => void
  'message:fetch:summary': (data: FetchSummaryMessageOpts) => void
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
  // Invoke requests
  'storage:fetch:messages': (data: { chatId: string, pagination: CorePagination }) => void
  'storage:record:messages': (data: EventaPayload<typeof StorageRecordMessages>) => void
  'storage:fetch:dialogs': (data: { accountId: string }) => void
  'storage:record:dialogs': (data: EventaPayload<typeof StorageRecordDialogs>) => void
  'storage:record:chat-folders': (data: EventaPayload<typeof StorageRecordChatFolders>) => void
  'storage:search:messages': (data: CoreMessageSearchParams) => void
  'storage:search:photos': (data: CorePhotoSearchParams) => void
  'storage:fetch:message-context': (data: StorageMessageContextParams) => void
  'storage:record:dialog-note': (data: { chatId: string, note: string, modify: boolean }) => void
  'takeout:run': (data: EventaPayload<typeof TakeoutRun>) => void
  'takeout:task:abort': (data: EventaPayload<typeof TakeoutTaskAbort>) => void
  'takeout:stats:fetch': (data: { chatId: string }) => void
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
 * Look up a fire-and-forget Eventa definition by its string event ID.
 * Used by the WebSocket bridge to convert incoming string event types to Eventa objects.
 *
 * NOTE: This does NOT return invoke events. Use `invokeEventConfig` for those.
 */
export function getCoreEventById(id: string): Eventa<any> | undefined {
  return _coreEventLookup.get(id)
}

/**
 * Check whether a given WS event ID corresponds to an invoke (RPC) event.
 */
export function isInvokeEventId(id: string): boolean {
  return id in invokeEventConfig
}

// ============================================================================
// Legacy Type Helpers
// ============================================================================

export type ExtractData<T> = (T extends (data: infer D) => void ? D : never)

export interface CoreEventMeta {
  tracingId: string
}
