// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/photos.ts

import type { CoreMessageMediaPhoto } from '../index'
import type { DBInsertPhoto } from './utils/photos'

import { Ok } from '@unbird/result'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { withDb } from '../db'
import { photosTable } from '../schemas/photos'
import { must0 } from './utils/must'

export async function findPhotoByFileId(fileId: string) {
  const photos = (await withDb(db => db
    .select()
    .from(photosTable)
    .where(
      and(
        eq(photosTable.platform, 'telegram'),
        eq(photosTable.file_id, fileId),
      ),
    ),
  )).expect('Failed to find photos by file ID')

  return Ok(must0(photos))
}

export async function recordPhotos(media: CoreMessageMediaPhoto[]) {
  if (media.length === 0) {
    return
  }

  const dataToInsert = media
    .filter(media => media.byte != null)
    .map(
      media => ({
        platform: 'telegram',
        file_id: media.platformId,
        message_id: media.messageUUID,
        image_bytes: media.byte,
      } satisfies DBInsertPhoto),
    )

  return withDb(async db => db
    .insert(photosTable)
    .values(dataToInsert)
    .onConflictDoUpdate({
      target: [photosTable.platform, photosTable.file_id],
      set: {
        image_bytes: sql`excluded.image_bytes`,
        updated_at: Date.now(),
      },
    })
    .returning(),
  )
}

export async function findPhotosByMessageId(messageUUID: string) {
  return withDb(db => db
    .select()
    .from(photosTable)
    .where(eq(photosTable.message_id, messageUUID)),
  )
}

export async function findPhotosByMessageIds(messageUUIDs: string[]) {
  return withDb(db => db
    .select()
    .from(photosTable)
    .where(inArray(photosTable.message_id, messageUUIDs)),
  )
}
