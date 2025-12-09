import type { photosTable } from '../../schemas/photos'
import type { CoreMessageMediaPhoto } from '../../types/media'

export type DBInsertPhoto = typeof photosTable.$inferInsert
export type DBSelectPhoto = typeof photosTable.$inferSelect

export function convertDBPhotoToCoreMessageMedia(dbPhoto: DBSelectPhoto): CoreMessageMediaPhoto {
  return {
    type: 'photo',
    messageUUID: dbPhoto.message_id ?? undefined,
    platformId: dbPhoto.file_id,
    // Expose queryId so clients can fetch media via HTTP endpoints.
    queryId: dbPhoto.id,
  } satisfies CoreMessageMediaPhoto
}
