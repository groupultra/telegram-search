import type { photosTable } from '../../schemas/photos'
import type { CoreMessageMediaPhoto } from '../../types/media'

export type DBInsertPhoto = typeof photosTable.$inferInsert
export type DBSelectPhoto = typeof photosTable.$inferSelect

export function convertDBPhotoToCoreMessageMedia(dbPhoto: DBSelectPhoto): CoreMessageMediaPhoto {
  return {
    type: 'photo',
    messageUUID: dbPhoto.message_id ?? undefined,
    byte: dbPhoto.image_bytes ?? undefined,
    platformId: dbPhoto.file_id,
  } satisfies CoreMessageMediaPhoto
}
