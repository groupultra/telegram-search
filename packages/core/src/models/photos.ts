// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/photos.ts

// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

import type { CoreDB } from '../db'
import type { CoreMessageMediaPhoto } from '../types/media'
import type { DBInsertPhoto } from './utils/photos'

import { Ok } from '@unbird/result'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { photosTable } from '../schemas/photos'
import { must0 } from './utils/must'

export async function findPhotoByFileId(db: CoreDB, fileId: string) {
  const photos = await db
    .select()
    .from(photosTable)
    .where(
      and(
        eq(photosTable.platform, 'telegram'),
        eq(photosTable.file_id, fileId),
      ),
    )
    .limit(1)

  return Ok(must0(photos))
}

export async function findPhotoByFileIdWithMimeType(db: CoreDB, fileId: string) {
  const photo = await db
    .select({
      id: photosTable.id,
      mimeType: photosTable.image_mime_type,
    })
    .from(photosTable)
    .where(
      and(
        eq(photosTable.platform, 'telegram'),
        eq(photosTable.file_id, fileId),
      ),
    )
    .limit(1)

  return Ok(must0(photo))
}

export async function findPhotoByQueryId(db: CoreDB, queryId: string) {
  const photos = await db
    .select()
    .from(photosTable)
    .where(eq(photosTable.id, queryId))

  return Ok(must0(photos))
}

type PhotoMediaForRecord = CoreMessageMediaPhoto & {
  byte?: Buffer
}

export async function recordPhotos(db: CoreDB, media: PhotoMediaForRecord[]) {
  if (media.length === 0) {
    return Ok([])
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

  if (dataToInsert.length === 0) {
    return Ok([])
  }

  const rows = await db
    .insert(photosTable)
    .values(dataToInsert)
    .onConflictDoUpdate({
      target: [photosTable.platform, photosTable.file_id],
      set: {
        image_bytes: sql`excluded.image_bytes`,
        updated_at: Date.now(),
      },
    })
    .returning()

  return Ok(rows)
}

export async function findPhotosByMessageId(db: CoreDB, messageUUID: string) {
  const rows = await db
    .select()
    .from(photosTable)
    .where(eq(photosTable.message_id, messageUUID))

  return Ok(rows)
}

export async function findPhotosByMessageIds(db: CoreDB, messageUUIDs: string[]) {
  const rows = await db
    .select()
    .from(photosTable)
    .where(inArray(photosTable.message_id, messageUUIDs))

  return Ok(rows)
}
