/**
 * Shared event dispatch maps for bridging string-based wire protocol
 * to typed Eventa event objects.
 *
 * Used by both the server WebSocket bridge and the client core-bridge adapter.
 */
import type { Eventa, InvokeEventa } from '@moeru/eventa'

import { authCodeEvent, authCodeNeededEvent, authConnectedEvent, authDisconnectedEvent, authErrorEvent, authLoginEvent, authLogoutEvent, authPasswordEvent, authPasswordNeededEvent } from './auth'
import { botSendMessageEvent, botStatusEvent } from './bot'
import { configFetchInvoke, configUpdateInvoke } from './config'
import { dialogAvatarDataEvent, dialogAvatarFetchEvent, dialogFetchInvoke, dialogFoldersFetchInvoke } from './dialog'
import { entityAvatarDataEvent, entityAvatarFetchEvent, entityAvatarPrimeCacheEvent, entityChatAvatarPrimeCacheEvent, entityProcessEvent } from './entity'
import { gramMessageReceivedEvent } from './gram'
import { coreErrorEvent } from './instance'
import { messageDataEvent, messageFetchAbortEvent, messageFetchEvent, messageFetchProgressEvent, messageFetchSpecificEvent, messageFetchSummaryInvoke, messageFetchUnreadInvoke, messageProcessedEvent, messageReadEvent, messageReprocessEvent, messageSendEvent } from './message'
import { accountReadyEvent, entityMeDataEvent, sessionUpdateEvent } from './session'
import { storageChatNoteInvoke, storageFetchDialogsInvoke, storageFetchMessageContextInvoke, storageFetchMessagesInvoke, storageRecordChatFoldersEvent, storageRecordDialogsEvent, storageRecordMessagesEvent, storageSearchMessagesInvoke, storageSearchPhotosInvoke } from './storage'
import { syncCatchUpEvent, syncResetEvent, syncStatusEvent } from './sync'
import { takeoutMetricsEvent, takeoutRunEvent, takeoutStatsFetchInvoke, takeoutTaskAbortEvent, takeoutTaskProgressEvent } from './takeout'

// ─── Fire-and-forget event mapping ────────────────────────────────────────────
// Maps wire event name → Eventa event object for plain emit()

export const fireAndForgetEvents = new Map<string, Eventa<any>>([
  // Auth
  ['auth:login', authLoginEvent],
  ['auth:logout', authLogoutEvent],
  ['auth:code', authCodeEvent],
  ['auth:password', authPasswordEvent],
  // Message commands
  ['message:fetch', messageFetchEvent],
  ['message:fetch:abort', messageFetchAbortEvent],
  ['message:fetch:specific', messageFetchSpecificEvent],
  ['message:send', messageSendEvent],
  ['message:read', messageReadEvent],
  ['message:reprocess', messageReprocessEvent],
  // Dialog commands
  ['dialog:avatar:fetch', dialogAvatarFetchEvent],
  // Entity commands
  ['entity:process', entityProcessEvent],
  ['entity:avatar:fetch', entityAvatarFetchEvent],
  ['entity:avatar:prime-cache', entityAvatarPrimeCacheEvent],
  ['entity:chat-avatar:prime-cache', entityChatAvatarPrimeCacheEvent],
  // Storage commands
  ['storage:record:messages', storageRecordMessagesEvent],
  ['storage:record:dialogs', storageRecordDialogsEvent],
  ['storage:record:chat-folders', storageRecordChatFoldersEvent],
  // Takeout commands
  ['takeout:run', takeoutRunEvent],
  ['takeout:task:abort', takeoutTaskAbortEvent],
  // Bot commands
  ['bot:send:message', botSendMessageEvent],
  // Sync commands
  ['sync:catch-up', syncCatchUpEvent],
  ['sync:reset', syncResetEvent],
])

// ─── RPC invoke event mapping ─────────────────────────────────────────────────
// Maps wire event name → { invoke event, response wire event name }

export interface RpcEntry {
  invoke: InvokeEventa<any, any>
  responseEvent: string
}

export const rpcEvents = new Map<string, RpcEntry>([
  ['storage:fetch:messages', { invoke: storageFetchMessagesInvoke, responseEvent: 'storage:messages' }],
  ['storage:fetch:dialogs', { invoke: storageFetchDialogsInvoke, responseEvent: 'storage:dialogs' }],
  ['storage:search:messages', { invoke: storageSearchMessagesInvoke, responseEvent: 'storage:search:messages:data' }],
  ['storage:search:photos', { invoke: storageSearchPhotosInvoke, responseEvent: 'storage:search:photos:data' }],
  ['storage:fetch:message-context', { invoke: storageFetchMessageContextInvoke, responseEvent: 'storage:messages:context' }],
  ['storage:record:dialog-note', { invoke: storageChatNoteInvoke, responseEvent: 'storage:dialog-note' }],
  ['config:fetch', { invoke: configFetchInvoke, responseEvent: 'config:data' }],
  ['config:update', { invoke: configUpdateInvoke, responseEvent: 'config:data' }],
  ['dialog:fetch', { invoke: dialogFetchInvoke, responseEvent: 'dialog:data' }],
  ['dialog:folders:fetch', { invoke: dialogFoldersFetchInvoke, responseEvent: 'dialog:folders:data' }],
  ['takeout:stats:fetch', { invoke: takeoutStatsFetchInvoke, responseEvent: 'takeout:stats:data' }],
  ['message:fetch:unread', { invoke: messageFetchUnreadInvoke, responseEvent: 'message:unread-data' }],
  ['message:fetch:summary', { invoke: messageFetchSummaryInvoke, responseEvent: 'message:summary-data' }],
])

// ─── Notification event mapping ───────────────────────────────────────────────
// Maps wire event name → Eventa event object for subscribing to core notifications.
// These are "fromCore" events broadcast to all connected peers/listeners.

export const notificationEvents = new Map<string, Eventa<any>>([
  // Core lifecycle
  ['core:error', coreErrorEvent],
  // Auth state
  ['auth:code:needed', authCodeNeededEvent],
  ['auth:password:needed', authPasswordNeededEvent],
  ['auth:connected', authConnectedEvent],
  ['auth:disconnected', authDisconnectedEvent],
  ['auth:error', authErrorEvent],
  // Session
  ['session:update', sessionUpdateEvent],
  ['account:ready', accountReadyEvent],
  // Message
  ['message:data', messageDataEvent],
  ['message:fetch:progress', messageFetchProgressEvent],
  ['message:processed', messageProcessedEvent],
  // Dialog
  ['dialog:avatar:data', dialogAvatarDataEvent],
  // Entity
  ['entity:me:data', entityMeDataEvent],
  ['entity:avatar:data', entityAvatarDataEvent],
  // Takeout
  ['takeout:task:progress', takeoutTaskProgressEvent],
  ['takeout:metrics', takeoutMetricsEvent],
  // Gram
  ['gram:message:received', gramMessageReceivedEvent],
  // Bot
  ['bot:status', botStatusEvent],
  // Sync
  ['sync:status', syncStatusEvent],
])

/**
 * Check if an event name is a known core event (fire-and-forget, RPC, or notification).
 */
export function isCoreEvent(eventName: string): boolean {
  return fireAndForgetEvents.has(eventName) || rpcEvents.has(eventName)
}
