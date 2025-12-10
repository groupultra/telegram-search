// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/stickers.ts

// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

import type { CoreDB } from '../db'
import type { CoreMessageMediaSticker } from '../types/media'

import { Ok } from '@unbird/result'
import { eq, sql } from 'drizzle-orm'

import { stickersTable } from '../schemas/stickers'
import { must0 } from './utils/must'

export async function findStickerByFileId(db: CoreDB, fileId: string) {
  const sticker = await db
    .select()
    .from(stickersTable)
    .where(eq(stickersTable.file_id, fileId))
    .limit(1)

  return Ok(must0(sticker))
}

export async function findStickerByQueryId(db: CoreDB, queryId: string) {
  const stickers = await db
    .select()
    .from(stickersTable)
    .where(eq(stickersTable.id, queryId))

  return Ok(must0(stickers))
}

export async function getStickerQueryIdByFileId(db: CoreDB, fileId: string) {
  const stickers = await db
    .select({
      id: stickersTable.id,
    })
    .from(stickersTable)
    .where(eq(stickersTable.file_id, fileId))
    .limit(1)

  return Ok(must0(stickers))
}

export async function recordStickers(db: CoreDB, stickers: (CoreMessageMediaSticker & { byte?: Buffer })[]) {
  if (stickers.length === 0) {
    return Ok([])
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
    return Ok([])
  }

  const rows = await db
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

  return Ok(rows)
}
