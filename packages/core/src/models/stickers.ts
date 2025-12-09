// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/stickers.ts

// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

import type { CoreDB } from '../db'
import type { CoreMessageMediaSticker } from '../types/media'

import { Err, Ok } from '@unbird/result'
import { eq, sql } from 'drizzle-orm'

import { withDb } from '../db'
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

  if (stickers.length === 0) {
    return Err(new Error('Sticker not found'))
  }

  return Ok(stickers[0].id)
}

type StickerMediaForRecord = CoreMessageMediaSticker & {
  byte?: Buffer
}

export async function recordStickers(stickers: StickerMediaForRecord[]) {
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
      emoji: sticker.emoji ?? '',
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
        emoji: sql`excluded.emoji`,
        sticker_bytes: sql`excluded.sticker_bytes`,
        updated_at: Date.now(),
      },
    })
    .returning(),
  )
}
