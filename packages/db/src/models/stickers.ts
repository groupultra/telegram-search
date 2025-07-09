// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/stickers.ts

import type { CoreMessageMedia } from '../../../core/src'

import { Ok } from '@tg-search/result'
import { desc, eq, sql } from 'drizzle-orm'

import { withDb } from '../drizzle'
import { recentSentStickersTable } from '../schemas/recent_sent_stickers'
import { stickersTable } from '../schemas/stickers'

export type StickerMedia = CoreMessageMedia & { sticker_id: string, emoji?: string }

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

  if (sticker.length === 0) {
    return undefined
  }

  return Ok(sticker[0])
}

export async function recordStickers(stickers: StickerMedia[]) {
  if (stickers.length === 0) {
    return []
  }

  // 对贴纸数组进行去重，以 file_id 为唯一标识
  const uniqueStickers = stickers.filter((sticker, index, self) =>
    index === self.findIndex(s => s.sticker_id === sticker.sticker_id),
  )

  const filteredStickers = uniqueStickers.filter(sticker => sticker.byte != null)

  return withDb(async db => db
    .insert(stickersTable)
    .values(filteredStickers.map(sticker => ({
      platform: 'telegram',
      file_id: sticker.sticker_id,
      sticker_bytes: sticker.byte,
      sticker_path: '',
      description: '',
      name: '',
      emoji: sticker.emoji ?? '',
      label: '',
    })))
    .onConflictDoUpdate({
      target: [stickersTable.file_id],
      set: {
        sticker_bytes: sql`EXCLUDED.sticker_bytes`,
        emoji: sql`EXCLUDED.emoji`,
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
