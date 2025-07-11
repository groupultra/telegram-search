// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/photos.ts

import type { CoreMessageMedia } from '../../../core/src'
import type { DBInsertPhoto } from './utils/photos'

import { Ok } from '@tg-search/result'
import { eq, inArray } from 'drizzle-orm'

import { withDb } from '../drizzle'
import { photosTable } from '../schemas/photos'

export type PhotoMedia = CoreMessageMedia & { photo_id: string }

export async function findPhotoByFileId(fileId: string) {
  const photo = (await withDb(db => db
    .select()
    .from(photosTable)
    .where(eq(photosTable.file_id, fileId))
    .limit(1),
  )).expect('Failed to find photo by file ID')

  if (photo.length === 0) {
    return undefined
  }

  return Ok(photo[0])
}

export async function recordPhotos(media: PhotoMedia[]) {
  if (media.length === 0) {
    return
  }

  const filteredMedia = media.filter(media => media.byte != null && media.photo_id !== '')

  const dataToInsert = filteredMedia.map(
    media => ({
      platform: 'telegram',
      file_id: media.photo_id,
      message_id: media.messageUUID,
      image_bytes: media.byte,
      image_path: media.path,
      description: '',
    } satisfies DBInsertPhoto),
  )

  return withDb(async db => db
    .insert(photosTable)
    .values(dataToInsert)
    .onConflictDoNothing()
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
