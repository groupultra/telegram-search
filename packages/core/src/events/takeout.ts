import type { ChatSyncStats, SyncOptions, TakeoutMetrics } from '../types/events'
import type { CoreTaskData } from '../types/task'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

// ============================================================================
// Takeout commands (fire-and-forget)
// ============================================================================

/** Start a takeout/export job */
export const takeoutRunEvent = defineEventa<{ chatIds: string[], increase?: boolean, syncOptions?: SyncOptions }>('takeout:run')

/** Abort a running takeout task */
export const takeoutTaskAbortEvent = defineEventa<{ taskId: string }>('takeout:task:abort')

// ============================================================================
// Takeout RPC
// ============================================================================

/** Fetch sync statistics for a chat (RPC) */
export const takeoutStatsFetchInvoke = defineInvokeEventa<
  ChatSyncStats,
  { chatId: string }
>('takeout:stats:fetch')

// ============================================================================
// Takeout notifications (core → client)
// ============================================================================

/** Task progress update */
export const takeoutTaskProgressEvent = defineEventa<CoreTaskData<'takeout'>>('takeout:task:progress')

/** Task performance metrics */
export const takeoutMetricsEvent = defineEventa<TakeoutMetrics>('takeout:metrics')
