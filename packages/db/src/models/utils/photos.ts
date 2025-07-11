import type { UUID } from 'node:crypto'

import type { CoreMessageMediaPhoto } from '../../../../core/src'
import type { photosTable } from '../../schemas/photos'

export type DBInsertPhoto = typeof photosTable.$inferInsert
export type DBSelectPhoto = typeof photosTable.$inferSelect

export function convertDBPhotoToCoreMessageMedia(dbPhoto: DBSelectPhoto): CoreMessageMediaPhoto {
  return {
    type: 'photo',
    messageUUID: dbPhoto.message_id as UUID,
    byte: dbPhoto.image_bytes ?? undefined,
    platformId: dbPhoto.file_id,
  } satisfies CoreMessageMediaPhoto
}
