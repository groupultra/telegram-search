// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/photos.ts

// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

import type { CoreDB } from '../db'
import type { CoreMessageMediaPhoto } from '../types/media'
import type { PromiseResult } from '../utils/result'
import type { DBInsertPhoto, DBSelectPhoto } from './utils/types'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { photosTable } from '../schemas/photos'
import { withResult } from '../utils/result'
import { must0 } from './utils/must'

/**
 * Record photos for a specific account
 */
export async function recordPhotos(db: CoreDB, media: (CoreMessageMediaPhoto & { byte?: Buffer })[]): Promise<DBInsertPhoto[]> {
  if (media.length === 0) {
    return []
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
    return []
  }

  return db
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
}

/**
 * Find a photo by file_id
 */
export async function findPhotoByFileId(db: CoreDB, fileId: string): PromiseResult<DBSelectPhoto> {
  return withResult(async () => {
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

    return must0(photos)
  })
}

/**
 * Find a photo by file_id with mime_type
 */
export async function findPhotoByFileIdWithMimeType(db: CoreDB, fileId: string): PromiseResult<{ id: string, mimeType: string }> {
  return withResult(async () => {
    const photos = await db
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

    return must0(photos)
  })
}

/**
 * Find a photo by query_id
 */
export async function findPhotoByQueryId(db: CoreDB, queryId: string): PromiseResult<DBSelectPhoto> {
  return withResult(async () => {
    const photos = await db
      .select()
      .from(photosTable)
      .where(eq(photosTable.id, queryId))
      .limit(1)

    return must0(photos)
  })
}

export async function findPhotosByMessageId(db: CoreDB, messageUUID: string): PromiseResult<DBSelectPhoto[]> {
  return withResult(() => db
    .select()
    .from(photosTable)
    .where(eq(photosTable.message_id, messageUUID)),
  )
}

export async function findPhotosByMessageIds(db: CoreDB, messageUUIDs: string[]): PromiseResult<DBSelectPhoto[]> {
  return withResult(() => db
    .select()
    .from(photosTable)
    .where(inArray(photosTable.message_id, messageUUIDs)),
  )
}
