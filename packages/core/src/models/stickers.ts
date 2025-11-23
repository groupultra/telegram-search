// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/stickers.ts

import type { CoreMessageMediaSticker } from '../types/media'

import { Ok } from '@unbird/result'
import { desc, eq, sql } from 'drizzle-orm'

import { withDb } from '../db'
import { recentSentStickersTable } from '../schemas/recent-sent-stickers'
import { stickersTable } from '../schemas/stickers'
import { must0 } from './utils/must'

export async function findStickerDescription(fileId: string) {
  const sticker = (await findStickerByFileId(fileId))?.unwrap()
  if (sticker == null) {
    return ''
  }

  return Ok(sticker.description)
}

export async function findStickerByFileId(fileId: string) {
  const sticker = (await withDb(db => db
    .select()
    .from(stickersTable)
    .where(eq(stickersTable.file_id, fileId))
    .limit(1),
  )).expect('Failed to find sticker by file ID')

  return Ok(must0(sticker))
}

export async function recordStickers(stickers: CoreMessageMediaSticker[]) {
  if (stickers.length === 0) {
    return
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
    // TODO: Emoji
    }))

  if (dataToInsert.length === 0) {
    return
  }

  return withDb(async db => db
    .insert(stickersTable)
    .values(dataToInsert)
    .onConflictDoUpdate({
      target: [stickersTable.platform, stickersTable.file_id],
      set: {
        sticker_bytes: sql`excluded.sticker_bytes`,
        updated_at: Date.now(),
      },
    })
    .returning(),
  )
}

export async function listRecentSentStickers() {
  return withDb(db => db
    .select()
    .from(recentSentStickersTable)
    .orderBy(desc(recentSentStickersTable.created_at)),
  )
}
