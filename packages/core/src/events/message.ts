import type { Api } from 'telegram'

import type { FetchMessageOpts, FetchSummaryMessageOpts, FetchUnreadMessageOpts, SummaryMode, SyncOptions } from '../types/events'
import type { CoreMessage } from '../types/message'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

// ============================================================================
// Message commands (fire-and-forget)
// ============================================================================

/** Fetch messages from Telegram with progress tracking */
export const messageFetchEvent = defineEventa<FetchMessageOpts>('message:fetch')

/** Abort an ongoing message fetch task */
export const messageFetchAbortEvent = defineEventa<{ taskId: string }>('message:fetch:abort')

/** Fetch specific messages by ID from Telegram */
export const messageFetchSpecificEvent = defineEventa<{ chatId: string, messageIds: number[] }>('message:fetch:specific')

/** Send a message to a chat */
export const messageSendEvent = defineEventa<{ chatId: string, content: string }>('message:send')

/** Mark messages as read in a chat */
export const messageReadEvent = defineEventa<{ chatId: string }>('message:read')

/** Re-process specific messages to regenerate resolver outputs */
export const messageReprocessEvent = defineEventa<{ chatId: string, messageIds: number[], resolvers?: string[] }>('message:reprocess')

// ============================================================================
// Message RPC
// ============================================================================

/** Fetch unread messages (RPC) */
export const messageFetchUnreadInvoke = defineInvokeEventa<
  { messages: CoreMessage[] },
  FetchUnreadMessageOpts
>('message:fetch:unread')

/** Fetch message summary (RPC) */
export const messageFetchSummaryInvoke = defineInvokeEventa<
  { messages: CoreMessage[], mode: SummaryMode, requestId?: string },
  FetchSummaryMessageOpts
>('message:fetch:summary')

// ============================================================================
// Message notifications (core → client)
// ============================================================================

/** Message fetch progress update */
export const messageFetchProgressEvent = defineEventa<{ taskId: string, progress: number }>('message:fetch:progress')

/** New message data from Telegram (real-time or fetch result) */
export const messageDataEvent = defineEventa<{ messages: CoreMessage[] }>('message:data')

// ============================================================================
// Internal message processing events
// ============================================================================

/**
 * Process raw Telegram messages through resolvers.
 * If `isTakeout` is true, suppresses browser-facing MessageData emissions.
 */
export const messageProcessEvent = defineEventa<{
  messages: Api.Message[]
  isTakeout?: boolean
  syncOptions?: SyncOptions
  forceRefetch?: boolean
  batchId?: string
}>('message:process')

/** Batch processing completed notification */
export const messageProcessedEvent = defineEventa<{
  batchId: string
  count: number
  resolverSpans: Array<{
    name: string
    duration: number
    count: number
  }>
}>('message:processed')
