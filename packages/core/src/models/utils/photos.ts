import type { CoreMessageMediaPhoto } from '../../types/media'
import type { DBSelectPhoto } from './types'

export function convertDBPhotoToCoreMessageMedia(dbPhoto: DBSelectPhoto): CoreMessageMediaPhoto {
  return {
    type: 'photo',
    messageUUID: dbPhoto.message_id ?? undefined,
    platformId: dbPhoto.file_id,
    // Expose queryId so clients can fetch media via HTTP endpoints.
    queryId: dbPhoto.id,
  } satisfies CoreMessageMediaPhoto
}
