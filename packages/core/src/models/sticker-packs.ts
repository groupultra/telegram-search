// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/sticker-packs.ts

import { desc } from 'drizzle-orm'

import { withDb } from '../db'
import { stickerPacksTable } from '../schemas/sticker_packs'

export async function recordStickerPack(platformId: string, name: string, platform = 'telegram') {
  return withDb(async db => db
    .insert(stickerPacksTable)
    .values({
      platform,
      platform_id: platformId,
      name,
      description: '',
    })
    .returning(),
  )
}

export async function listStickerPacks() {
  return withDb(db => db
    .select()
    .from(stickerPacksTable)
    .orderBy(desc(stickerPacksTable.created_at)),
  )
}
