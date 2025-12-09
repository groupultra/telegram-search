// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/photos.ts

// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

import type { CoreDB } from '../db'
import type { CoreMessageMediaPhoto } from '../types/media'
import type { DBInsertPhoto } from './utils/photos'

import { Err, Ok } from '@unbird/result'
import { and, eq, inArray, sql } from 'drizzle-orm'

import { withDb } from '../db'
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

export async function getPhotoQueryIdByFileId(db: CoreDB, fileId: string) {
  const photos = await db
    .select({
      id: photosTable.id,
    })
    .from(photosTable)
    .where(
      and(
        eq(photosTable.platform, 'telegram'),
        eq(photosTable.file_id, fileId),
      ),
    )
    .limit(1)

  if (photos.length === 0) {
    return Err(new Error('Photo not found'))
  }

  return Ok(photos[0].id)
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

export async function recordPhotos(media: PhotoMediaForRecord[]) {
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

  if (dataToInsert.length === 0) {
    return
  }

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
