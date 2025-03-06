import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { useDB } from '@tg-search/common'
import { and, eq } from 'drizzle-orm'

import { syncConfigItems } from '../schema/sync'

// Export types
export type DatabaseSyncConfig = InferSelectModel<typeof syncConfigItems>
export type DatabaseNewSyncConfig = InferInsertModel<typeof syncConfigItems>

/**
 * Update or create a sync configuration
 */
export async function upsertSyncConfig(chatId: number, data: Partial<DatabaseNewSyncConfig>) {
  const syncType = data.syncType ?? 'default' // Ensure syncType is not undefined
  return useDB()
    .insert(syncConfigItems)
    .values({
      chatId,
      syncType,
      ...data,
    })
    .onConflictDoUpdate({
      target: [syncConfigItems.chatId, syncConfigItems.syncType],
      set: {
        ...data,
        updatedAt: new Date(), // Ensure updatedAt is set on update
      },
    })
    .returning()
}

/**
 * Update sync configuration status
 */
export async function updateSyncStatus(
  chatId: number,
  data: Pick<DatabaseNewSyncConfig, 'status' | 'lastError' | 'lastSyncTime'>,
) {
  return useDB()
    .update(syncConfigItems)
    .set(data)
    .where(eq(syncConfigItems.chatId, chatId))
    .returning()
}

/**
 * Get sync configuration by chat ID
 */
export async function getSyncConfigByChatId(chatId: number) {
  return useDB()
    .select()
    .from(syncConfigItems)
    .where(eq(syncConfigItems.chatId, chatId))
    .limit(1)
    .then(result => result[0])
}

/**
 * Get sync configuration by chat ID and sync type
 */
export async function getSyncConfigByChatIdAndType(chatId: number, syncType: string) {
  return useDB()
    .select()
    .from(syncConfigItems)
    .where(and(
      eq(syncConfigItems.chatId, chatId),
      eq(syncConfigItems.syncType, syncType),
    ))
    .limit(1)
    .then((result: Array<typeof syncConfigItems.$inferSelect>) => result[0])
}

/**
 * Cancel sync configuration
 */
export async function cancelSyncConfig(chatId: number, syncType?: string) {
  const query = useDB()
    .update(syncConfigItems)
    .set({ status: 'cancelled' })

  if (syncType) {
    query.where(eq(syncConfigItems.syncType, syncType))
  }

  return query
    .where(eq(syncConfigItems.chatId, chatId))
    .returning()
}
