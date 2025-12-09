// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/sticker-packs.ts

import type { CoreDB } from '../db'

import { Ok } from '@unbird/result'
import { desc } from 'drizzle-orm'

import { stickerPacksTable } from '../schemas/sticker-packs'

export async function recordStickerPack(db: CoreDB, platformId: string, name: string, platform = 'telegram') {
  const rows = await db
    .insert(stickerPacksTable)
    .values({
      platform,
      platform_id: platformId,
      name,
      description: '',
    })
    .returning()

  return Ok(rows)
}

export async function listStickerPacks(db: CoreDB) {
  const rows = await db
    .select()
    .from(stickerPacksTable)
    .orderBy(desc(stickerPacksTable.created_at))

  return Ok(rows)
}
