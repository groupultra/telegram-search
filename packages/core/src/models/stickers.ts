// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/stickers.ts

// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

import type { CoreDB } from '../db'
import type { CoreMessageMediaSticker } from '../types/media'
import type { PromiseResult } from '../utils/result'
import type { DBInsertSticker, DBSelectSticker } from './utils/types'

import { eq, sql } from 'drizzle-orm'

import { stickersTable } from '../schemas/stickers'
import { withResult } from '../utils/result'
import { must0 } from './utils/must'

/**
 * Record stickers for a specific account
 */
export async function recordStickers(db: CoreDB, stickers: (CoreMessageMediaSticker & { byte?: Buffer })[]): Promise<DBInsertSticker[]> {
  if (stickers.length === 0) {
    return []
  }

  // Deduplicate the sticker array, using file_id as the unique identifier
  const uniqueStickers = stickers.filter((sticker, index, self) =>
    index === self.findIndex(s => s.platformId === sticker.platformId),
  )

  const dataToInsert = uniqueStickers
    .filter(sticker => sticker.byte != null)
    .map(sticker => ({
      platform: 'telegram',
      file_id: sticker.platformId ?? '',
      sticker_bytes: sticker.byte,
      emoji: sticker.emoji ?? '',
    }))

  if (dataToInsert.length === 0) {
    return []
  }

  return db
    .insert(stickersTable)
    .values(dataToInsert)
    .onConflictDoUpdate({
      target: [stickersTable.platform, stickersTable.file_id],
      set: {
        emoji: sql`excluded.emoji`,
        sticker_bytes: sql`excluded.sticker_bytes`,
        updated_at: Date.now(),
      },
    })
    .returning()
}

/**
 * Find a sticker by file_id
 */
export async function findStickerByFileId(db: CoreDB, fileId: string): PromiseResult<DBSelectSticker> {
  return withResult(async () => {
    const sticker = await db
      .select()
      .from(stickersTable)
      .where(eq(stickersTable.file_id, fileId))
      .limit(1)

    return must0(sticker)
  })
}

/**
 * Find a sticker by query_id
 */
export async function findStickerByQueryId(db: CoreDB, queryId: string): PromiseResult<DBSelectSticker> {
  return withResult(async () => {
    const stickers = await db
      .select()
      .from(stickersTable)
      .where(eq(stickersTable.id, queryId))

    return must0(stickers)
  })
}

/**
 * Get the query_id for a sticker by file_id
 */
export async function getStickerQueryIdByFileId(db: CoreDB, fileId: string): PromiseResult<{ id: string }> {
  return withResult(async () => {
    const stickers = await db
      .select({
        id: stickersTable.id,
      })
      .from(stickersTable)
      .where(eq(stickersTable.file_id, fileId))
      .limit(1)

    return must0(stickers)
  })
}
