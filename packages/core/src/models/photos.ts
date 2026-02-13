// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/photos.ts

// eslint-disable-next-line unicorn/prefer-node-protocol
import type { Buffer } from 'buffer'

import type { CoreDB } from '../db'
import type { CoreMessageMediaPhoto } from '../types/media'
import type { PromiseResult } from '../utils/result'
import type { DBInsertPhoto, DBSelectPhoto } from './utils/types'

import { and, cosineDistance, eq, gt, inArray, sql } from 'drizzle-orm'

import { chatMessagesTable } from '../schemas/chat-messages'
import { joinedChatsTable } from '../schemas/joined-chats'
import { photosTable } from '../schemas/photos'
import { withResult } from '../utils/result'
import { must0 } from './utils/must'

type PhotoMediaForRecord = CoreMessageMediaPhoto & {
  uuid: string
  byte?: Buffer
  mimeType?: string
  /**
   * Optional external storage path when a MediaBinaryProvider is configured.
   * When present, this value will be persisted to image_path instead of
   * storing raw bytes in image_bytes.
   */
  storagePath?: string
}

async function recordPhotos(db: CoreDB, media: PhotoMediaForRecord[]): Promise<DBInsertPhoto[]> {
  if (media.length === 0) {
    return []
  }

  const dataToInsert = media
    .filter(media => media.byte != null || media.storagePath)
    .map((media) => {
      return {
        id: media.uuid,
        platform: 'telegram',
        file_id: media.platformId,
        message_id: media.messageUUID,
        // Clear image_bytes if storagePath is present
        image_bytes: media.storagePath ? null : media.byte,
        image_path: media.storagePath,
        image_mime_type: media.mimeType,
      } satisfies DBInsertPhoto
    })

  if (dataToInsert.length === 0) {
    return []
  }

  return db
    .insert(photosTable)
    .values(dataToInsert)
    .onConflictDoUpdate({
      target: [photosTable.platform, photosTable.file_id],
      set: {
        message_id: sql`excluded.message_id`,
        image_bytes: sql`excluded.image_bytes`,
        // Only update image_path if new value is not empty
        image_path: sql`CASE WHEN excluded.image_path != '' THEN excluded.image_path ELSE ${photosTable.image_path} END`,
        image_mime_type: sql`excluded.image_mime_type`,
        updated_at: Date.now(),
      },
    })
    .returning()
}

/**
 * Update the message_id field for an existing photo
 */
async function updatePhotoMessageId(db: CoreDB, photoId: string, messageUUID: string): Promise<void> {
  await db
    .update(photosTable)
    .set({
      message_id: messageUUID,
      updated_at: Date.now(),
    })
    .where(eq(photosTable.id, photoId))
}

/**
 * Find a photo by file_id
 */
async function findPhotoByFileId(db: CoreDB, fileId: string): PromiseResult<DBSelectPhoto> {
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
async function findPhotoByFileIdWithMimeType(db: CoreDB, fileId: string): PromiseResult<{ id: string, mimeType: string }> {
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
 * Find photos by message UUIDs (for batch processing)
 */
async function findPhotosByMessageUUIDs(db: CoreDB, messageUUIDs: string[]): PromiseResult<DBSelectPhoto[]> {
  if (messageUUIDs.length === 0) {
    return withResult(async () => [])
  }

  return withResult(async () => {
    return db
      .select()
      .from(photosTable)
      .where(inArray(photosTable.message_id, messageUUIDs))
  })
}

/**
 * Find a photo by query_id
 */
async function findPhotoByQueryId(db: CoreDB, queryId: string): PromiseResult<DBSelectPhoto> {
  return withResult(async () => {
    const photos = await db
      .select()
      .from(photosTable)
      .where(eq(photosTable.id, queryId))
      .limit(1)

    return must0(photos)
  })
}

async function findPhotosByMessageId(db: CoreDB, messageUUID: string): PromiseResult<DBSelectPhoto[]> {
  return withResult(() => db
    .select()
    .from(photosTable)
    .where(eq(photosTable.message_id, messageUUID)),
  )
}

async function findPhotosByMessageIds(db: CoreDB, messageUUIDs: string[]): PromiseResult<DBSelectPhoto[]> {
  return withResult(() => db
    .select()
    .from(photosTable)
    .where(inArray(photosTable.message_id, messageUUIDs)),
  )
}

/**
 * Search photos by description embedding (vector similarity search)
 * Includes message and chat information via JOIN
 */
async function searchPhotosByVector(
  db: CoreDB,
  embedding: number[],
  dimension: 768 | 1024 | 1536,
  limit: number = 10,
  minSimilarity: number = 0.2,
): PromiseResult<Array<DBSelectPhoto & { similarity: number, chat_id?: string, chat_name?: string, platform_message_id?: string }>> {
  return withResult(async () => {
    const vectorColumn = dimension === 1536
      ? photosTable.description_vector_1536
      : dimension === 1024
        ? photosTable.description_vector_1024
        : photosTable.description_vector_768

    const results = await db
      .select({
        id: photosTable.id,
        platform: photosTable.platform,
        file_id: photosTable.file_id,
        message_id: photosTable.message_id,
        image_bytes: photosTable.image_bytes,
        image_thumbnail_bytes: photosTable.image_thumbnail_bytes,
        image_path: photosTable.image_path,
        image_thumbnail_path: photosTable.image_thumbnail_path,
        image_mime_type: photosTable.image_mime_type,
        image_width: photosTable.image_width,
        image_height: photosTable.image_height,
        caption: photosTable.caption,
        description: photosTable.description,
        created_at: photosTable.created_at,
        updated_at: photosTable.updated_at,
        description_vector_1536: photosTable.description_vector_1536,
        description_vector_1024: photosTable.description_vector_1024,
        description_vector_768: photosTable.description_vector_768,
        similarity: sql<number>`1 - (${cosineDistance(vectorColumn, embedding)})`.as('similarity'),
        // Message and chat info
        chat_id: chatMessagesTable.in_chat_id,
        chat_name: joinedChatsTable.chat_name,
        platform_message_id: chatMessagesTable.platform_message_id,
      })
      .from(photosTable)
      .leftJoin(chatMessagesTable, eq(photosTable.message_id, chatMessagesTable.id))
      .leftJoin(joinedChatsTable, eq(chatMessagesTable.in_chat_id, joinedChatsTable.chat_id))
      .where(and(
        sql`${vectorColumn} IS NOT NULL`,
        gt(sql`1 - (${cosineDistance(vectorColumn, embedding)})`, minSimilarity),
      ))
      .orderBy(cosineDistance(vectorColumn, embedding))
      .limit(limit)

    return results as Array<DBSelectPhoto & { similarity: number, chat_id?: string, chat_name?: string, platform_message_id?: string }>
  })
}

/**
 * Search photos by description text (full-text search)
 * Includes message and chat information via JOIN
 */
async function searchPhotosByText(
  db: CoreDB,
  searchText: string,
  limit: number = 10,
): PromiseResult<Array<DBSelectPhoto & { chat_id?: string, chat_name?: string, platform_message_id?: string }>> {
  return withResult(async () => {
    const results = await db
      .select({
        id: photosTable.id,
        platform: photosTable.platform,
        file_id: photosTable.file_id,
        message_id: photosTable.message_id,
        image_bytes: photosTable.image_bytes,
        image_thumbnail_bytes: photosTable.image_thumbnail_bytes,
        image_path: photosTable.image_path,
        image_thumbnail_path: photosTable.image_thumbnail_path,
        image_mime_type: photosTable.image_mime_type,
        image_width: photosTable.image_width,
        image_height: photosTable.image_height,
        caption: photosTable.caption,
        description: photosTable.description,
        created_at: photosTable.created_at,
        updated_at: photosTable.updated_at,
        description_vector_1536: photosTable.description_vector_1536,
        description_vector_1024: photosTable.description_vector_1024,
        description_vector_768: photosTable.description_vector_768,
        // Message and chat info
        chat_id: chatMessagesTable.in_chat_id,
        chat_name: joinedChatsTable.chat_name,
        platform_message_id: chatMessagesTable.platform_message_id,
      })
      .from(photosTable)
      .leftJoin(chatMessagesTable, eq(photosTable.message_id, chatMessagesTable.id))
      .leftJoin(joinedChatsTable, eq(chatMessagesTable.in_chat_id, joinedChatsTable.chat_id))
      .where(sql`${photosTable.description} ILIKE ${`%${searchText}%`}`)
      .orderBy(photosTable.created_at)
      .limit(limit)

    return results as Array<DBSelectPhoto & { chat_id?: string, chat_name?: string, platform_message_id?: string }>
  })
}

/**
 * Update photo description and embedding vectors
 */
async function updatePhotoEmbedding(
  db: CoreDB,
  photoId: string,
  data: {
    description: string
    vector: number[]
    dimension: 768 | 1024 | 1536
  },
): PromiseResult<DBSelectPhoto> {
  return withResult(async () => {
    const updateData: Partial<DBSelectPhoto> = {
      description: data.description,
      updated_at: Date.now(),
    }

    // 根据向量维度设置对应的字段
    switch (data.dimension) {
      case 1536:
        updateData.description_vector_1536 = data.vector
        break
      case 1024:
        updateData.description_vector_1024 = data.vector
        break
      case 768:
        updateData.description_vector_768 = data.vector
        break
      default:
        throw new Error(`Unsupported vector dimension: ${data.dimension}`)
    }

    const result = await db
      .update(photosTable)
      .set(updateData)
      .where(eq(photosTable.id, photoId))
      .returning()

    return must0(result)
  })
}

export const photoModels = {
  recordPhotos,
  updatePhotoMessageId,
  findPhotoByFileId,
  findPhotoByFileIdWithMimeType,
  findPhotosByMessageUUIDs,
  findPhotoByQueryId,
  findPhotosByMessageId,
  findPhotosByMessageIds,
  searchPhotosByVector,
  searchPhotosByText,
  updatePhotoEmbedding,
}

export type PhotoModels = typeof photoModels
