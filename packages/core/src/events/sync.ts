import { defineEventa } from '@moeru/eventa'

// ============================================================================
// Sync commands (fire-and-forget)
// ============================================================================

/** Catch up on missed updates via PTS/QTS */
export const syncCatchUpEvent = defineEventa<void>('sync:catch-up')

/** Reset sync state */
export const syncResetEvent = defineEventa<void>('sync:reset')

// ============================================================================
// Sync notifications (core → client)
// ============================================================================

/** Sync status update */
export const syncStatusEvent = defineEventa<{ status: 'idle' | 'syncing' | 'error', progress?: number }>('sync:status')
