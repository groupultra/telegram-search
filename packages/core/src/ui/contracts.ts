/**
 * Eventa contracts between the UI client and an account's core.
 *
 * Decision:
 * - The UI reaches core only through the commands listed here. Each command
 *   has a Valibot schema; unknown fields are stripped and invalid payloads
 *   are dropped before anything reaches the core event emitter.
 * - Core events that are not listed (storage writes, message processing,
 *   Telegram updates, account setup) have no contract, so no transport can
 *   deliver them from a client.
 * Constraints:
 * - Handlers read the account from the core context, never from a payload.
 * - Server and browser-only mode bind the same contracts (see `register.ts`).
 */

import type { Eventa, InvokeEventa } from '@moeru/eventa'
import type { GenericSchema } from 'valibot'

import type { CoreEvent, ToCoreEvent } from '../types/events'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'
import { array, boolean, number, object, optional, picklist, string, undefined as undefinedSchema, union } from 'valibot'

import { accountSettingsSchema } from '../types/account-settings'
import { CoreEventType } from '../types/events'

type Payload<F> = F extends () => void ? undefined : F extends (data: infer D) => void ? D : never

export type UiCommandInput<T extends UiCommandType> = Payload<ToCoreEvent[T]>
export type UiNotificationData<T extends UiNotificationType> = T extends keyof UiServerNotifications
  ? UiServerNotifications[T]
  : T extends keyof CoreEvent ? Payload<CoreEvent[T]> : never

const noInput = optional(undefinedSchema())
const paginationSchema = object({ offset: number(), limit: number() })
const timeRangeSchema = object({ start: optional(number()), end: optional(number()) })
const takeoutSyncOptionsSchema = object({
  syncMedia: optional(boolean()),
  maxMediaSize: optional(number()),
  startTime: optional(number()),
  endTime: optional(number()),
  minMessageId: optional(number()),
  maxMessageId: optional(number()),
  skipMedia: optional(boolean()),
  skipEmbedding: optional(boolean()),
  skipJieba: optional(boolean()),
})

const commandSchemas = {
  [CoreEventType.AuthLogin]: object({ phoneNumber: optional(string()), session: optional(string()) }),
  [CoreEventType.AuthLogout]: noInput,
  [CoreEventType.AuthCode]: object({ code: string() }),
  [CoreEventType.AuthPassword]: object({ password: string() }),

  [CoreEventType.ConfigFetch]: noInput,
  [CoreEventType.ConfigUpdate]: object({ accountSettings: accountSettingsSchema }),

  [CoreEventType.DialogFoldersFetch]: noInput,
  [CoreEventType.DialogAvatarFetch]: object({ chatId: union([number(), string()]) }),

  [CoreEventType.EntityAvatarFetch]: object({ userId: string(), fileId: optional(string()) }),
  [CoreEventType.EntityAvatarPrimeCache]: object({ userId: string(), fileId: string() }),
  [CoreEventType.EntityChatAvatarPrimeCache]: object({ chatId: string(), fileId: string() }),

  [CoreEventType.MessageFetchSummary]: object({
    chatId: string(),
    mode: picklist(['unread', 'today', 'last24h']),
    requestId: optional(string()),
    limit: optional(number()),
  }),
  [CoreEventType.MessageRead]: object({ chatId: string() }),
  [CoreEventType.MessageReprocess]: object({ chatId: string(), messageIds: array(number()), resolvers: optional(array(string())) }),
  [CoreEventType.MessageSend]: object({ chatId: string(), content: string() }),

  [CoreEventType.StorageFetchDialogs]: noInput,
  [CoreEventType.StorageSearchMessages]: object({
    requestId: optional(string()),
    chatId: optional(string()),
    content: string(),
    useVector: boolean(),
    pagination: optional(paginationSchema),
    chatIds: optional(array(string())),
    fromUserId: optional(string()),
    timeRange: optional(timeRangeSchema),
  }),
  [CoreEventType.StorageSearchPhotos]: object({
    requestId: optional(string()),
    content: string(),
    useVector: boolean(),
    pagination: optional(paginationSchema),
    chatIds: optional(array(string())),
    timeRange: optional(timeRangeSchema),
  }),
  [CoreEventType.StorageFetchMessageEditMarks]: object({ chatId: string(), messageIds: array(string()), requestId: optional(string()) }),
  [CoreEventType.StorageChatNote]: object({ chatId: string(), note: string(), modify: boolean() }),

  [CoreEventType.TakeoutRun]: object({ chatIds: array(string()), increase: optional(boolean()), syncOptions: optional(takeoutSyncOptionsSchema) }),
  [CoreEventType.TakeoutTaskAbort]: object({ taskId: string() }),
  [CoreEventType.TakeoutStatsFetch]: object({ chatId: string() }),
  [CoreEventType.TakeoutConfirmResponse]: object({ authorized: boolean() }),
} as const

/** Core events a UI client may send. */
export type UiCommandType = keyof typeof commandSchemas

export interface UiCommandContract<T extends UiCommandType> {
  eventa: Eventa<UiCommandInput<T>>
  schema: GenericSchema<unknown, UiCommandInput<T>>
}

// Compile-time check that every schema's output matches the payload the
// core handler expects. A schema that drifts from `ToCoreEvent` fails here.
const checkedCommandSchemas: { [T in UiCommandType]: GenericSchema<unknown, UiCommandInput<T>> } = commandSchemas

function command<T extends UiCommandType>(type: T): UiCommandContract<T> {
  return {
    eventa: defineEventa<UiCommandInput<T>>(`tg.ui.v1.command.${type}`),
    schema: checkedCommandSchemas[type],
  }
}

export const uiCommandContracts: { [T in UiCommandType]: UiCommandContract<T> } = Object.fromEntries(
  (Object.keys(commandSchemas) as UiCommandType[]).map(type => [type, command(type)]),
) as { [T in UiCommandType]: UiCommandContract<T> }

export const uiCoreNotificationTypes = [
  CoreEventType.CoreError,
  CoreEventType.AuthCodeNeeded,
  CoreEventType.AuthPasswordNeeded,
  CoreEventType.AuthConnected,
  CoreEventType.AuthDisconnected,
  CoreEventType.AuthError,
  CoreEventType.SessionUpdate,
  CoreEventType.AccountReady,
  CoreEventType.ConfigData,
  CoreEventType.MessageData,
  CoreEventType.MessageUnreadData,
  CoreEventType.MessageSummaryData,
  CoreEventType.MessageUpdated,
  CoreEventType.MessageDeleted,
  CoreEventType.DialogData,
  CoreEventType.DialogFoldersData,
  CoreEventType.DialogAvatarData,
  CoreEventType.EntityMeData,
  CoreEventType.EntityAvatarData,
  CoreEventType.StorageDialogs,
  CoreEventType.StorageSearchMessagesData,
  CoreEventType.StorageSearchPhotosData,
  CoreEventType.StorageMessageEditMarks,
  CoreEventType.StorageChatNoteData,
  CoreEventType.TakeoutTaskProgress,
  CoreEventType.TakeoutStatsData,
  CoreEventType.TakeoutMetrics,
  CoreEventType.TakeoutConfirmNeeded,
  CoreEventType.SyncStatus,
] as const

/** Core events forwarded to UI clients. */
export type UiCoreNotificationType = typeof uiCoreNotificationTypes[number]

export type SignInTicketResult = { ticket: string } | { error: 'OAUTH_DISABLED' | 'ACCOUNT_NOT_READY' | 'TICKET_FAILED' }

/** Notifications the transport itself sends, not core. */
export interface UiServerNotifications {
  'server:connected': { sessionId: string, accountReady: boolean }
}

export type UiNotificationType = UiCoreNotificationType | keyof UiServerNotifications

export const uiNotificationContracts: { [T in UiNotificationType]: Eventa<UiNotificationData<T>> } = Object.fromEntries(
  [...uiCoreNotificationTypes, 'server:connected' as const].map(type => [type, defineEventa(`tg.ui.v1.notification.${type}`)]),
) as { [T in UiNotificationType]: Eventa<UiNotificationData<T>> }

/**
 * Issues a single-use ticket for `POST /api/auth/sign-in/telegram-session`.
 * The server answers it; browser-only mode has no server and refuses.
 */
export const signInTicketContract: InvokeEventa<SignInTicketResult, undefined> = defineInvokeEventa<SignInTicketResult, undefined>('tg.ui.v1.server.sign-in-ticket')

/**
 * Transport heartbeat strings. They are answered before any Eventa decoding
 * and never reach core.
 */
export const UI_HEARTBEAT_PING = '{"type":"server:ping"}'
export const UI_HEARTBEAT_PONG = '{"type":"server:pong"}'
